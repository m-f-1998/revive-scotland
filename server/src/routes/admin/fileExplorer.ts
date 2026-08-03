import { randomUUID } from "crypto"

import { addUserPath, checkFirebaseAuth, validateS3Key } from "./middleware/fileExplorer.js"
import { onFilesDeleted, onFileRenamed, onFolderRenamed } from "./mediaReferences.js"
import { getFirestore, incrementValue } from "../admin.js"
import { FastifyPluginAsync } from "fastify"
import { S3Service } from "../../services/s3.service.js"
import { join } from "path"
import { readdir, stat } from "fs/promises"

const PUBLIC_DOMAIN = process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk"

const MAX_STORAGE_GB = 5
const MAX_STORAGE_BYTES = MAX_STORAGE_GB * 1024 * 1024 * 1024

const STATIC_ASSETS_DIR = join ( process.cwd ( ), "../", "assets", "img" )

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
      const data = await S3Service.listObjects ( prefix )

      // Folders (CommonPrefixes)
      const folders = ( data.CommonPrefixes || [] ).map ( p => ( {
        name: p.Prefix?.replace ( prefix, "" ).replace ( "/", "" ),
        key: p.Prefix,
        isFolder: true,
      } ) )

      // Files (Contents)
      const EXTENSION_TYPES: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
        webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
        pdf: "application/pdf", txt: "text/plain",
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
        mp3: "audio/mpeg", wav: "audio/wav",
        zip: "application/zip", json: "application/json",
        doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }

      const files = ( data.Contents || [ ] ).filter ( f => f.Key !== prefix ).map ( f => {
        const ext = f.Key?.split ( "." ).pop ( )?.toLowerCase ( ) ?? ""
        return {
          name: f.Key?.replace ( prefix, "" ),
          key: f.Key,
          lastModified: f.LastModified,
          size: f.Size,
          isFolder: false,
          contentType: EXTENSION_TYPES [ ext ] ?? "application/octet-stream"
        }
      } )

      return rep.status ( 200 ).send ( [ ...folders, ...files ] )
    } catch ( error ) {
      console.error ( "Error listing files:", error )
      return rep.status ( 500 ).send ( "Failed to list files." )
    }
  } )

  /**
   * 1b. NAVIGATE STATIC ASSETS
   * Lists built-in files and folders from the local assets directory.
   */
  app.get ( "/static-list", async ( req, rep ) => {
    const { path } = req.query as { path?: string }
    const relativePath = path || "/"

    if ( relativePath && ( typeof relativePath !== "string" || relativePath.includes ( ".." ) ) ) {
      return rep.status ( 400 ).send ( "Invalid path." )
    }

    const currentDir = join ( STATIC_ASSETS_DIR, relativePath )

    try {
      const entries = await readdir ( currentDir, { withFileTypes: true } )
      const folders = [ ]
      const files = [ ]

      const EXTENSION_TYPES: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
        webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime"
      }

      for ( const entry of entries ) {
        if ( entry.isDirectory ( ) ) {
          const folderKey = relativePath === "/" ? `${entry.name}/` : `${relativePath}${entry.name}/`
          folders.push ( {
            name: entry.name,
            key: folderKey,
            isFolder: true
          } )
        } else if ( entry.isFile ( ) ) {
          const ext = entry.name.split ( "." ).pop ( )?.toLowerCase ( ) ?? ""
          if ( Object.keys ( EXTENSION_TYPES ).includes ( ext ) ) {
            const fileStat = await stat ( join ( currentDir, entry.name ) )
            const fileKey = relativePath === "/" ? entry.name : `${relativePath}${entry.name}`
            files.push ( {
              name: entry.name,
              key: fileKey,
              lastModified: fileStat.mtime,
              size: fileStat.size,
              isFolder: false,
              contentType: EXTENSION_TYPES [ ext ] ?? "application/octet-stream"
            } )
          }
        }
      }

      return rep.status ( 200 ).send ( [ ...folders, ...files ] )
    } catch ( error ) {
      console.error ( "Error listing static files:", error )
      return rep.status ( 500 ).send ( "Failed to list static files." )
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
      const uploadUrl = await S3Service.generateUploadUrl ( key, contentType, fileSize )
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
      await S3Service.createFolder ( key )
      return rep.status ( 201 ).send ( { message: "Folder created." } )
    } catch ( error ) {
      console.error ( "Error creating folder:", error )
      return rep.status ( 500 ).send ( "Failed to create folder." )
    }
  } )

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
        const files = await S3Service.listAllKeysUnderPrefix ( key )
        if ( files.length === 0 ) {
          return rep.status ( 200 ).send ( { message: "Folder is empty or already deleted." } )
        }

        // 2. Calculate total size and delete all objects
        totalSizeDeleted = files.reduce ( ( acc, file ) => acc + file.size, 0 )
        const deletePromises = files.map ( file => S3Service.deleteObject ( file.key ) )

        // Cascade: remove media references BEFORE deleting share links
        await onFilesDeleted ( files.map ( f => f.key ) )

        await Promise.all ( deletePromises )
      } else {
        try {
          // First, get the file size for quota update
          totalSizeDeleted = await S3Service.getObjectSize ( key )
        } catch ( error ) {
          const { name, $metadata } = error as { name: string; $metadata?: { httpStatusCode?: number } }
          if ( name === "NotFound" || $metadata?.httpStatusCode === 404 ) {
            // File already gone. This is OK, but we don't update quota.
            return rep.status ( 200 ).send ( { message: "File already deleted." } )
          }
          throw error // Rethrow other errors
        }

        await S3Service.deleteObject ( key )

        const db = getFirestore ( )
        const querySnapshot = await db.collection ( "shared_links" ).where ( "key", "==", key ).get ( )

        // Cascade: remove media references BEFORE deleting share links
        await onFilesDeleted ( [ key ] )

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
    } catch ( error ) {
      const { name, $metadata } = error as { name: string; $metadata?: { httpStatusCode?: number } }
      if ( name === "NotFound" || $metadata?.httpStatusCode === 404 ) {
        // File already gone. This is OK, but we don't update quota.
        return rep.status ( 200 ).send ( { message: "File already deleted." } )
      }
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
        const files = await S3Service.listAllKeysUnderPrefix ( oldKey )

        // 2. Copy all files to the new location first
        await Promise.all ( files.map ( file => S3Service.copyObject ( file.key, file.key.replace ( oldKey, newKey ) ) ) )

        // 3. Update share links before deleting originals so active URLs remain valid
        await onFolderRenamed ( oldKey, newKey )

        // 4. Only delete originals after share links are updated
        await Promise.all ( files.map ( file => S3Service.deleteObject ( file.key ) ) )
      } else {
        // 1. Copy the object
        await S3Service.copyObject ( oldKey, newKey )

        // 2. Update share link key before deleting so existing URLs remain valid
        await onFileRenamed ( oldKey, newKey )

        // 3. Delete the old object
        await S3Service.deleteObject ( oldKey )
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
      const shareUrl = `${PUBLIC_DOMAIN}/api/share/${shareId}`

      return rep.status ( 200 ).send ( { shareUrl } )
    } catch ( error ) {
      console.error ( "Error generating share URL:", error )
      return rep.status ( 500 ).send ( "Failed to generate URL." )
    }
  } )

  /**
   * 5b. GET SHARE INFO
   * Resolves the filename from a shared UUID.
   */
  app.get ( "/share-info/:id", async ( req, rep ) => {
    const { id } = req.params as { id: string }
    if ( !id ) return rep.status ( 400 ).send ( "Missing id parameter." )

    try {
      const doc = await getFirestore ( ).collection ( "shared_links" ).doc ( id ).get ( )
      if ( !doc.exists ) {
        return rep.status ( 404 ).send ( { error: "Link not found." } )
      }

      const key = doc.data ( )?. [ "key" ] || ""
      const filename = key.split ( "/" ).pop ( ) || id

      return rep.status ( 200 ).send ( { filename } )
    } catch ( error ) {
      console.error ( "Error getting share info:", error )
      return rep.status ( 500 ).send ( "Failed to get share info." )
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

      console.log ( `User ${req.user!.uid} has used ${storageUsed} bytes of storage.` )

      return rep.status ( 200 ).send ( {
        used: storageUsed,
        max: MAX_STORAGE_BYTES,
        remaining: MAX_STORAGE_BYTES - storageUsed,
      } )
    } catch ( error ) {
      // If not found, assume zero usage
      if ( ( error as { code?: number } ).code === 5 ) {
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
    const { key, fileSize } = req.body as { key?: string; fileSize?: number }

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key'." )
    }

    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

    try {
      const actualSize = await S3Service.getObjectSize ( key )

      if ( typeof fileSize === "number" && fileSize > 0 && Math.abs ( actualSize - fileSize ) > 1024 ) {
        return rep.status ( 400 ).send ( "File size mismatch." )
      }

      await userRef.set ( { storageUsed: incrementValue ( actualSize ) }, { merge: true } )

      return rep.status ( 200 ).send ( { message: "Quota updated." } )
    } catch ( error ) {
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

      const viewUrl = `${PUBLIC_DOMAIN}/api/share/${shareId}`
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