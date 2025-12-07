import { Router, Request, Response } from "express"
import { rateLimit } from "express-rate-limit"

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

export const router = Router ( )

// Apply auth middleware to all routes in this router
router.use ( checkFirebaseAuth, addUserPath, validateS3Key )

router.use ( rateLimit ( {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  keyGenerator: ( req: Request ) => {
    return req.user ? req.user.uid : ( req?.ip || "" )
  }
} ) )

/**
 * 1. NAVIGATE FOLDER STRUCTURE
 * Lists files and folders for a given path.
 */
router.get ( "/list", async ( req: Request, res: Response ) => {
  const userPath = req.user!.s3Path!
  // 'path' query param is relative to user's root (e.g., '/documents' or '/')
  const relativePath = req.query [ "path" ] as string || "/"

  // Ensure path doesn't try to go up (e.g. '../')
  if ( relativePath.includes ( ".." ) ) {
    res.status ( 400 ).json ( "Invalid path." )
    return
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

    res.json ( [ ...folders, ...( await Promise.all ( files ) ) ] )
  } catch ( error ) {
    console.error ( "Error listing files:", error )
    res.status ( 500 ).json ( "Failed to list files." )
  }
} )

/**
 * 2. UPLOAD A FILE (Get Presigned URL)
 * Generates a secure, temporary URL for the client to upload a file directly.
 */
router.post ( "/upload-url", async ( req: Request, res: Response ) => {
  // key is the FULL S3 path (e.g., users/uid/docs/file.txt)
  const key = req.body?.key as string
  const contentType = req.body?.contentType as string
  const fileSize = req.body?.fileSize as number

  if ( !key || !contentType || !fileSize ) {
    res.status ( 400 ).json ( "Missing key, contentType, or fileSize." )
    return
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
      res.status ( 403 ).json ( "Upload would exceed your storage quota." )
      return
    }
  } catch {
    // If quota check fails, block the upload for safety
    res.status ( 500 ).json ( "Failed to verify storage quota." )
    return
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
    res.json ( { uploadUrl } )
  } catch ( error ) {
    console.error ( "Error generating upload URL:", error )
    res.status ( 500 ).json ( "Failed to generate URL." )
  }
} )

/**
 * (Helper for Upload) CREATE A FOLDER
 * S3 folders are just 0-byte objects with a trailing slash.
 */
router.post ( "/create-folder", async ( req: Request, res: Response ) => {
  const key = req.body?.key as string // e.g., users/uid/new-folder/

  if ( !key ) {
    res.status ( 400 ).json ( "Missing 'key' for folder creation." )
    return
  }

  if ( !key.endsWith ( "/" ) ) {
    res.status ( 400 ).json ( "Folder key must end with /" )
    return
  }

  const invalidChars = /[\\\/:*?"<>|]/ // Common invalid filename characters
  if ( invalidChars.test ( key.substring ( key.lastIndexOf ( "/" ) + 1 ) ) ) {
    res.status ( 400 ).json ( "Folder key contains invalid characters." )
    return
  }

  try {
    const command = new PutObjectCommand ( {
      Bucket: R2_BUCKET_NAME,
      Key: key
    } )
    await s3Client.send ( command )
    res.status ( 201 ).send ( { message: "Folder created." } )
  } catch ( error ) {
    console.error ( "Error creating folder:", error )
    res.status ( 500 ).json ( "Failed to create folder." )
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
router.post ( "/delete", async ( req: Request, res: Response ) => {
  const key = req.body?.key as string // Full S3 key
  const isFolder = req.body?.isFolder

  if ( !key ) {
    res.status ( 400 ).json ( "Missing 'key' for deletion." )
    return
  }

  const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

  try {
    let totalSizeDeleted = 0

    if ( isFolder ) {
      // 1. List all files under the prefix
      const files = await listAllKeys ( key )
      if ( files.length === 0 ) {
        res.status ( 200 ).send ( { message: "Folder is empty or already deleted." } )
        return
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
          res.status ( 200 ).send ( { message: "File already deleted." } )
          return
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

    res.status ( 200 ).send ( { message: "Delete successful." } )
  } catch ( error: any ) {
    console.error ( "Error deleting file/folder:", error )
    res.status ( 500 ).json ( "Failed to delete resource." )
    return
  }
} )

/**
 * 4. RENAME A FILE OR FOLDER
 * S3 has no "rename" or "move". It's a COPY + DELETE operation.
 */
router.post ( "/rename", async ( req: Request, res: Response ) => {
  const oldKey = req.body?.oldKey as string
  const newKey = req.body?.newKey as string
  const isFolder = req.body?.isFolder

  if ( !oldKey || !newKey ) {
    res.status ( 400 ).json ( "Missing 'oldKey' or 'newKey'." )
    return
  }

  if ( oldKey === newKey ) {
    res.status ( 400 ).json ( "'oldKey' and 'newKey' cannot be the same." )
    return
  }

  if ( oldKey.includes ( ".." ) || newKey.includes ( ".." ) ) {
    res.status ( 400 ).json ( "Invalid key with path traversal." )
    return
  }

  const invalidChars = /[\\\/:*?"<>|]/ // Common invalid filename characters
  if ( invalidChars.test ( newKey.substring ( newKey.lastIndexOf ( "/" ) + 1 ) ) ) {
    res.status ( 400 ).json ( "New key contains invalid characters." )
    return
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

    res.status ( 200 ).send ( { message: "Rename/Move successful." } )
  } catch ( error ) {
    console.error ( "Error renaming file:", error )
    res.status ( 500 ).json ( "Failed to rename file." )
  }
} )

/**
 * 5. CREATE A SHARED PUBLIC LINK (Presigned URL)
 */
router.get ( "/share-url", async ( req: Request, res: Response ) => {
  const key = req.query?. [ "key" ] as string

  if ( !key ) {
    res.status ( 400 ).json ( "Missing 'key' for sharing." )
    return
  }

  // Default to 1 day expiry, but could be passed from client
  let expiresIn = Number ( req.query?. [ "expiresIn" ] )
  if ( isNaN ( expiresIn ) || expiresIn === undefined ) {
    expiresIn = 86400 // 24 hours default
  }
  if ( expiresIn === 0 ) {
    expiresIn = 0 // Permanent link
  }

  try {
    const shareId = randomUUID ( )

    // Calculate expiry date
    let expiresAt = null
    if ( expiresIn > 0 ) {
      expiresAt = new Date ( Date.now ( ) + ( expiresIn * 1000 ) )
    }

    // Save to Firestore
    await getFirestore ( ).collection ( "shared_links" ).doc ( shareId ).set ( {
      key: key,
      uid: req.user!.uid,
      createdAt: new Date ( ),
      expiresAt: expiresAt, // Null means permanent
      type: expiresIn === 0 ? "hero_editor" : "share" // Optional: metadata
    } )

    // Return the URL for your domain
    // Assuming you mount the public router at /api/public
    const shareUrl = `${PUBLIC_DOMAIN}/api/public/s/${shareId}`

    res.json ( { shareUrl } )
  } catch ( error ) {
    console.error ( "Error generating share URL:", error )
    res.status ( 500 ).json ( "Failed to generate URL." )
  }
} )

/**
 * 6. GET USER QUOTA / SPACE LEFT (MODIFIED FOR QUOTA)
 * Reads from Firestore. Fast, efficient, and free.
 */
router.get ( "/quota", async ( req: Request, res: Response ) => {
  try {
    // 1. Fetch the user's quota doc from Firestore
    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )
    const userDoc = await userRef.get ( )

    let storageUsed = 0
    if ( userDoc.exists ) {
      storageUsed = userDoc.data ( )?. [ "storageUsed" ] || 0
    }

    res.json ( {
      used: storageUsed,
      max: MAX_STORAGE_BYTES,
      remaining: MAX_STORAGE_BYTES - storageUsed,
    } )
  } catch ( error: any ) {
    // If not found, assume zero usage
    if ( error.code === 5 ) {
      res.json ( {
        used: 0,
        max: MAX_STORAGE_BYTES,
        remaining: MAX_STORAGE_BYTES,
      } )
      return
    }
    console.error ( "Error getting quota:", error )
    res.status ( 500 ).json ( "Failed to get quota." )
  }
} )

/**
 * 7. NEW (REQUIRED FOR QUOTA): UPLOAD COMPLETE
 * Called by the client AFTER a successful S3 upload.
 */
router.post ( "/upload-complete", async ( req: Request, res: Response ) => {
  const key = req.body?.key as string // Only need the key

  if ( !key ) {
    res.status ( 400 ).json ( "Missing 'key'." )
    return
  }

  const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

  if ( !key ) {
    res.status ( 400 ).json ( "Missing 'key'." )
    return
  }

  try {
    const userPrefix = req.user!.s3Path!
    const allFiles = await listAllKeys ( userPrefix )
    const totalSize = allFiles.reduce ( ( acc, file ) => acc + file.size, 0 )
    await userRef.set ( {
      storageUsed: totalSize
    }, { merge: true } )

    res.status ( 200 ).send ( { message: "Quota updated." } )
  } catch ( error: any ) {
    if ( error.name === "NotFound" || error.$metadata?.httpStatusCode === 404 ) {
      res.status ( 404 ).json ( "Upload not found. Could not update quota." )
      return
    }
    if ( error.code === 5 ) {
      // User doc doesn't exist yet, create it with zero usage
      try {
        await userRef.set ( {
          storageUsed: 0
        } )
        res.status ( 200 ).send ( { message: "Quota initialized." } )
        return
      } catch ( e ) {
        console.error ( "Error initializing quota for new user.", e )
      }
    }
    console.error ( "Error updating quota:", error )
    res.status ( 500 ).json ( "Failed to update quota." )
  }
} )
/**
 * 8. VIEW FILE (For Admin Preview)
 * Enforces a 15-minute expiry.
 */
router.get ( "/view-url", async ( req: Request, res: Response ) => {
  const key = req.query?. [ "key" ] as string
  if ( !key ) {
    res.status ( 400 ).json ( "Missing 'key'." )
    return
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
    res.json ( { viewUrl } )
  } catch ( error ) {
    console.error ( "Error generating view URL:", error )
    res.status ( 500 ).json ( "Failed to generate URL." )
  }
} )

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