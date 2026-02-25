import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"

import { addUserPath, checkFirebaseAuth, validateS3Key } from "./middleware/fileExplorer.js"
import { getFirestore, incrementValue } from "../admin.js"
import { FastifyPluginAsync } from "fastify"

const R2_ACCOUNT_ID = process.env [ "R2_ACCOUNT_ID" ]
const R2_ACCESS_KEY_ID = process.env [ "R2_ACCESS_KEY_ID" ]
const R2_SECRET_ACCESS_KEY = process.env [ "R2_SECRET_ACCESS_KEY" ]
const R2_BUCKET_NAME = process.env [ "R2_BUCKET_NAME" ]
const PUBLIC_DOMAIN = process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk"

// This is the crucial part for R2
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

const MAX_STORAGE_GB = 5
const MAX_STORAGE_BYTES = MAX_STORAGE_GB * 1024 * 1024 * 1024

if ( !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME ) {
  throw new Error ( "R2 configuration is missing in environment variables." )
}

const s3Client = new S3Client ( {
  region: "auto", // R2's "auto" region
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  }
} )

export const router: FastifyPluginAsync = async app => {
  // app prehandler
  app.addHook ( "preHandler", checkFirebaseAuth )
  app.addHook ( "preHandler", addUserPath )
  app.addHook ( "preHandler", validateS3Key )

  /**
   * 1. NAVIGATE FOLDER STRUCTURE
   * Lists files and folders for a given path.
   */
  app.get ( "/list", async ( req, rep ) => {
    const userPath = req.user!.s3Path!
    // 'path' query param is relative to user's root (e.g., '/documents' or '/')
    const { path } = req.query as { path?: string }
    const relativePath = path || "/"

    // Ensure path doesn't try to go up (e.g. '../')
    if ( relativePath && ( typeof relativePath !== "string" || relativePath.includes ( ".." ) ) ) {
      return rep.status ( 400 ).send ( "Invalid path." )
    }

    // S3 prefix is the full path
    let prefix = userPath
    if ( relativePath !== "/" ) {
      prefix += relativePath.startsWith ( "/" ) ? relativePath.substring ( 1 ) : relativePath
      if ( !prefix.endsWith ( "/" ) ) prefix += "/" // Ensure it's a folder prefix
    }

    try {
      const command = new ListObjectsV2Command ( {
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        Delimiter: "/", // This is the magic for folders
      } )
      const data = await s3Client.send ( command )

      // Folders (CommonPrefixes)
      const folders = ( data.CommonPrefixes || [] ).map ( p => ( {
        name: p.Prefix?.replace ( prefix, "" ).replace ( "/", "" ),
        key: p.Prefix,
        isFolder: true,
      } ) )

      // Files (Contents)
      const files: Promise<any> [ ] = [ ]
      for ( const f of ( data.Contents || [ ] ).filter ( f => f.Key !== prefix ) ) {
        files.push ( ( async ( ) => {
          const head = await s3Client.send (
            new HeadObjectCommand ( {
              Bucket: R2_BUCKET_NAME,
              Key: f.Key!,
            } )
          )

          return {
            name: f.Key?.replace ( prefix, "" ),
            key: f.Key,
            lastModified: f.LastModified,
            size: f.Size, // In bytes
            isFolder: false,
            contentType: head.ContentType // Will be fetched on demand if needed
          }
        } ) ( ) )
      }

      return rep.status ( 200 ).send ( [ ...folders, ...( await Promise.all ( files ) ) ] )
    } catch ( error ) {
      console.error ( "Error listing files:", error )
      return rep.status ( 500 ).send ( "Failed to list files." )
    }
  } )

  /**
   * 2. UPLOAD A FILE (Get Presigned URL)
   * Generates a secure, temporary URL for the client to upload a file directly.
   */
  app.post ( "/upload-url", async ( req, rep ) => {
    // key is the FULL S3 path (e.g., users/uid/docs/file.txt)
    const { key, contentType, fileSize } = req.body as { key?: string; contentType?: string; fileSize?: number }

    if ( !key || !contentType || !fileSize ) {
      return rep.status ( 400 ).send ( "Missing key, contentType, or fileSize." )
    }

    try {
      const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )
      const userDoc = await userRef.get ( )

      let storageUsed = 0
      if ( userDoc.exists ) {
        storageUsed = userDoc.data ( )?. [ "storageUsed" ] || 0
      }

      const projectedUsage = storageUsed + Number ( fileSize || 0 )
      if ( projectedUsage > MAX_STORAGE_BYTES ) {
        return rep.status ( 403 ).send ( "Upload would exceed your storage quota." )
      }
    } catch {
      // If quota check fails, block the upload for safety
      return rep.status ( 500 ).send ( "Failed to verify storage quota." )
    }

    try {
      const command = new PutObjectCommand ( {
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        ContentLength: fileSize
      } )

      // This URL is valid for 2 minutes
      const uploadUrl = await getSignedUrl ( s3Client, command, { expiresIn: 120 } )
      return rep.status ( 200 ).send ( { uploadUrl } )
    } catch ( error ) {
      console.error ( "Error generating upload URL:", error )
      return rep.status ( 500 ).send ( "Failed to generate URL." )
    }
  } )

  /**
   * (Helper for Upload) CREATE A FOLDER
   * S3 folders are just 0-byte objects with a trailing slash.
   */
  app.post ( "/create-folder", async ( req, rep ) => {
    const { key } = req.body as { key?: string } // e.g., users/uid/new-folder/

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key' for folder creation." )
    }

    if ( !key.endsWith ( "/" ) ) {
      return rep.status ( 400 ).send ( "Folder key must end with /" )
    }

    const invalidChars = /[\\\/:*?"<>|]/ // Common invalid filename characters
    if ( invalidChars.test ( key.substring ( key.lastIndexOf ( "/" ) + 1 ) ) ) {
      return rep.status ( 400 ).send ( "Folder key contains invalid characters." )
    }

    try {
      const command = new PutObjectCommand ( {
        Bucket: R2_BUCKET_NAME,
        Key: key
      } )
      await s3Client.send ( command )
      return rep.status ( 201 ).send ( { message: "Folder created." } )
    } catch ( error ) {
      console.error ( "Error creating folder:", error )
      return rep.status ( 500 ).send ( "Failed to create folder." )
    }
  } )

  // Helper function to list all keys under a prefix, recursively
  const listAllKeys = async ( prefix: string ) => {
    const keys: { key: string; size: number }[] = []
    let isTruncated = true
    let continuationToken: string | undefined = undefined

    while ( isTruncated ) {
      const command: ListObjectsV2Command = new ListObjectsV2Command ( {
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken
      } )
      const data = await s3Client.send ( command );
      ( data.Contents || [ ] ).forEach ( item => {
        keys.push ( { key: item.Key!, size: item.Size || 0 } )
      } )

      isTruncated = data.IsTruncated || false
      continuationToken = data.NextContinuationToken
    }
    return keys
  }

  /**
   * 3. DELETE A FILE
   */
  app.post ( "/delete", async ( req, rep ) => {
    const { key, isFolder } = req.body as { key?: string; isFolder?: boolean }

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key' for deletion." )
    }

    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

    try {
      let totalSizeDeleted = 0

      if ( isFolder ) {
        // 1. List all files under the prefix
        const files = await listAllKeys ( key )
        if ( files.length === 0 ) {
          return rep.status ( 200 ).send ( { message: "Folder is empty or already deleted." } )
        }

        // 2. Calculate total size and delete all objects
        totalSizeDeleted = files.reduce ( ( acc, file ) => acc + file.size, 0 )
        const deletePromises = files.map ( file =>
          s3Client.send ( new DeleteObjectCommand ( { Bucket: R2_BUCKET_NAME, Key: file.key } ) )
        )
        await Promise.all ( deletePromises )
      } else {
        try {
          // First, get the file size for quota update
          const headCommand = new HeadObjectCommand ( {
            Bucket: R2_BUCKET_NAME,
            Key: key,
          } )
          const headData = await s3Client.send ( headCommand )
          totalSizeDeleted = headData.ContentLength || 0
        } catch ( error: any ) {
          if ( error.name === "NotFound" || error.$metadata?.httpStatusCode === 404 ) {
            // File already gone. This is OK, but we don't update quota.
            return rep.status ( 200 ).send ( { message: "File already deleted." } )
          }
          throw error // Rethrow other errors
        }

        const deleteCommand = new DeleteObjectCommand ( {
          Bucket: R2_BUCKET_NAME,
          Key: key,
        } )
        await s3Client.send ( deleteCommand )

        const db = getFirestore ( )
        const querySnapshot = await db.collection ( "shared_links" ).where ( "key", "==", key ).get ( )
        const batch = db.batch ( )
        querySnapshot.forEach ( doc => {
          batch.delete ( doc.ref )
        } )
        await batch.commit ( )
      }

      if ( totalSizeDeleted > 0 ) {
        await userRef.set ( { // Use set(merge:true) for safety
          storageUsed: incrementValue ( -Number ( totalSizeDeleted ) )
        }, { merge: true } )
      }

      return rep.status ( 200 ).send ( { message: "Delete successful." } )
    } catch ( error: any ) {
      console.error ( "Error deleting file/folder:", error )
      return rep.status ( 500 ).send ( "Failed to delete resource." )
    }
  } )

  /**
   * 4. RENAME A FILE OR FOLDER
   * S3 has no "rename" or "move". It's a COPY + DELETE operation.
   */
  app.post ( "/rename", async ( req, rep ) => {
    const { oldKey, newKey, isFolder } = req.body as { oldKey?: string; newKey?: string; isFolder?: boolean }

    if ( !oldKey || !newKey ) {
      return rep.status ( 400 ).send ( "Missing 'oldKey' or 'newKey'." )
    }

    if ( oldKey === newKey ) {
      return rep.status ( 400 ).send ( "'oldKey' and 'newKey' cannot be the same." )
    }

    if ( oldKey.includes ( ".." ) || newKey.includes ( ".." ) ) {
      return rep.status ( 400 ).send ( "Invalid key with path traversal." )
    }

    const invalidChars = /[\\\/:*?"<>|]/ // Common invalid filename characters
    if ( invalidChars.test ( newKey.substring ( newKey.lastIndexOf ( "/" ) + 1 ) ) ) {
      return rep.status ( 400 ).send ( "New key contains invalid characters." )
    }

    try {
      if ( isFolder ) {
        // 1. List all files under the prefix
        const files = await listAllKeys ( oldKey )

        // 2. Copy+Delete each file to the new location
        const operationPromises = files.flatMap ( file => {
          const targetKey = file.key.replace ( oldKey, newKey )

          // Return an array of two promises per file: Copy and Delete
          return [
            // 1. Copy
            s3Client.send ( new CopyObjectCommand ( {
              Bucket: R2_BUCKET_NAME,
              CopySource: `${R2_BUCKET_NAME}/${file.key}`,
              Key: targetKey,
            } ) ),
            // 2. Delete
            s3Client.send ( new DeleteObjectCommand ( {
              Bucket: R2_BUCKET_NAME,
              Key: file.key,
            } ) )
          ]
        } )
        // Execute ALL Copy and Delete operations concurrently
        await Promise.all ( operationPromises )
      } else {
        // 1. Copy the object
        const copyCommand = new CopyObjectCommand ( {
          Bucket: R2_BUCKET_NAME,
          CopySource: `${R2_BUCKET_NAME}/${oldKey}`,
          Key: newKey,
        } )
        await s3Client.send ( copyCommand )

        // 2. Delete the old object
        const deleteCommand = new DeleteObjectCommand ( {
          Bucket: R2_BUCKET_NAME,
          Key: oldKey,
        } )
        await s3Client.send ( deleteCommand )
      }

      return rep.status ( 200 ).send ( { message: "Rename/Move successful." } )
    } catch ( error ) {
      console.error ( "Error renaming file:", error )
      return rep.status ( 500 ).send ( "Failed to rename file." )
    }
  } )

  /**
   * 5. CREATE A SHARED PUBLIC LINK (Presigned URL)
   */
  app.get ( "/share-url", async ( req, rep ) => {
    const { key, expiresIn } = req.query as { key?: string; expiresIn?: string }

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key' for sharing." )
    }

    // Default to 1 day expiry, but could be passed from client
    let expires = Number ( expiresIn )
    if ( isNaN ( expires ) || expires === undefined ) {
      expires = 86400 // 24 hours default
    }
    if ( expires === 0 ) {
      expires = 0 // Permanent link
    }

    try {
      const shareId = randomUUID ( )

      // Calculate expiry date
      let expiresAt = null
      if ( expires > 0 ) {
        expiresAt = new Date ( Date.now ( ) + ( expires * 1000 ) )
      }

      // Save to Firestore
      await getFirestore ( ).collection ( "shared_links" ).doc ( shareId ).set ( {
        key: key,
        uid: req.user!.uid,
        createdAt: new Date ( ),
        expiresAt: expiresAt, // Null means permanent
        type: expires === 0 ? "hero_editor" : "share" // Optional: metadata
      } )

      // Return the URL for your domain
      // Assuming you mount the public router at /api/public
      const shareUrl = `${PUBLIC_DOMAIN}/api/public/s/${shareId}`

      return rep.status ( 200 ).send ( { shareUrl } )
    } catch ( error ) {
      console.error ( "Error generating share URL:", error )
      return rep.status ( 500 ).send ( "Failed to generate URL." )
    }
  } )

  /**
   * 6. GET USER QUOTA / SPACE LEFT (MODIFIED FOR QUOTA)
   * Reads from Firestore. Fast, efficient, and free.
   */
  app.get ( "/quota", async ( req, rep ) => {
    try {
      // 1. Fetch the user's quota doc from Firestore
      const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )
      const userDoc = await userRef.get ( )

      let storageUsed = 0
      if ( userDoc.exists ) {
        storageUsed = userDoc.data ( )?. [ "storageUsed" ] || 0
      }

      return rep.status ( 200 ).send ( {
        used: storageUsed,
        max: MAX_STORAGE_BYTES,
        remaining: MAX_STORAGE_BYTES - storageUsed,
      } )
    } catch ( error: any ) {
      // If not found, assume zero usage
      if ( error.code === 5 ) {
        return rep.status ( 200 ).send ( {
          used: 0,
          max: MAX_STORAGE_BYTES,
          remaining: MAX_STORAGE_BYTES,
        } )
      }
      console.error ( "Error getting quota:", error )
      return rep.status ( 500 ).send ( "Failed to get quota." )
    }
  } )

  /**
   * 7. NEW (REQUIRED FOR QUOTA): UPLOAD COMPLETE
   * Called by the client AFTER a successful S3 upload.
   */
  app.post ( "/upload-complete", async ( req, rep ) => {
    const { key } = req.body as { key?: string } // Only need the key

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key'." )
    }

    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key'." )
    }

    try {
      const userPrefix = req.user!.s3Path!
      const allFiles = await listAllKeys ( userPrefix )
      const totalSize = allFiles.reduce ( ( acc, file ) => acc + file.size, 0 )
      await userRef.set ( {
        storageUsed: totalSize
      }, { merge: true } )

      return rep.status ( 200 ).send ( { message: "Quota updated." } )
    } catch ( error: any ) {
      if ( error.name === "NotFound" || error.$metadata?.httpStatusCode === 404 ) {
        return rep.status ( 404 ).send ( "Upload not found. Could not update quota." )
      }
      if ( error.code === 5 ) {
        // User doc doesn't exist yet, create it with zero usage
        try {
          await userRef.set ( {
            storageUsed: 0
          } )
          return rep.status ( 200 ).send ( { message: "Quota initialized." } )
        } catch ( e ) {
          console.error ( "Error initializing quota for new user.", e )
        }
      }
      console.error ( "Error updating quota:", error )
      return rep.status ( 500 ).send ( "Failed to update quota." )
    }
  } )
  /**
   * 8. VIEW FILE (For Admin Preview)
   * Enforces a 15-minute expiry.
   */
  app.get ( "/view-url", async ( req, rep ) => {
    const { key } = req.query as { key?: string }
    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key'." )
    }

    try {
      const shareId = randomUUID ( )

      // Hardcoded 15 minutes for admin previews
      const expiresAt = new Date ( Date.now ( ) + ( 15 * 60 * 1000 ) )

      await getFirestore ( ).collection ( "shared_links" ).doc ( shareId ).set ( {
        key: key,
        uid: req.user!.uid,
        createdAt: new Date ( ),
        expiresAt: expiresAt,
        type: "admin_view"
      } )

      const viewUrl = `${PUBLIC_DOMAIN}/api/public/s/${shareId}`
      return rep.status ( 200 ).send ( { viewUrl } )
    } catch ( error ) {
      console.error ( "Error generating view URL:", error )
      return rep.status ( 500 ).send ( "Failed to generate URL." )
    }
  } )
}

export const cleanupSharedLinks = async ( ) => {
  try {
    const { getFirestore } = await import ( "../admin.js" )
    const db = getFirestore ( )
    const now = new Date ( )
    const snapshot = await db.collection ( "shared_links" )
      .where ( "expiresAt", "<=", now )
      .get ( )

    const batch = db.batch ( )
    snapshot.forEach ( doc => {
      batch.delete ( doc.ref )
    } )

    await batch.commit ( )
    console.log ( `Cleaned up ${snapshot.size} expired shared links.` )
  } catch ( error ) {
    console.error ( "Error cleaning up shared links:", error )
  }
}

// Schedule cleanup every hour
setInterval ( cleanupSharedLinks, 60 * 60 * 1000 ) // Every hour

// Initial cleanup on startup
cleanupSharedLinks ( )