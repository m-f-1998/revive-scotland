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

const ALLOWED_UPLOAD_MIME_TYPES = new Set ( [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
] )

const STATIC_ASSETS_DIR = join ( process.cwd ( ), "../", "assets", "img" )

export const router: FastifyPluginAsync = async app => {
  app.addHook ( "preHandler", checkFirebaseAuth )
  app.addHook ( "preHandler", addUserPath )
  app.addHook ( "preHandler", validateS3Key )

  let cleanupTimer: ReturnType<typeof setInterval> | undefined
  app.addHook ( "onReady", async ( ) => {
    await cleanupSharedLinks ( )
    cleanupTimer = setInterval ( ( ) => { void cleanupSharedLinks ( ) }, 60 * 60 * 1000 )
  } )
  app.addHook ( "onClose", async ( ) => {
    if ( cleanupTimer ) clearInterval ( cleanupTimer )
  } )

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
      const folders = ( data.CommonPrefixes || [ ] ).map ( p => ( {
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

  app.post ( "/upload-url", async ( req, rep ) => {
    // key is the FULL S3 path (e.g., users/uid/docs/file.txt)
    const { key, contentType, fileSize } = req.body as { key?: string; contentType?: string; fileSize?: number }

    if ( !key || !contentType || !fileSize ) {
      return rep.status ( 400 ).send ( "Missing key, contentType, or fileSize." )
    }

    if ( !ALLOWED_UPLOAD_MIME_TYPES.has ( contentType ) ) {
      return rep.status ( 400 ).send ( "Unsupported content type." )
    }

    const size = Number ( fileSize )
    if ( !Number.isFinite ( size ) || size <= 0 ) {
      return rep.status ( 400 ).send ( "Invalid fileSize." )
    }

    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

    try {
      await getFirestore ( ).runTransaction ( async tx => {
        const userDoc = await tx.get ( userRef )
        const storageUsed = userDoc.exists ? ( userDoc.data ( )?. [ "storageUsed" ] || 0 ) : 0

        if ( storageUsed + size > MAX_STORAGE_BYTES ) {
          throw new Error ( "QUOTA_EXCEEDED" )
        }

        tx.set ( userRef, { storageUsed: incrementValue ( size ) }, { merge: true } )
      } )
    } catch ( err ) {
      if ( err instanceof Error && err.message === "QUOTA_EXCEEDED" ) {
        return rep.status ( 403 ).send ( "Upload would exceed your storage quota." )
      }
      return rep.status ( 500 ).send ( "Failed to verify storage quota." )
    }

    try {
      const uploadUrl = await S3Service.generateUploadUrl ( key, contentType, size )
      return rep.status ( 200 ).send ( { uploadUrl } )
    } catch ( error ) {
      try {
        await userRef.set ( { storageUsed: incrementValue ( -size ) }, { merge: true } )
      } catch { /* best-effort rollback */ }
      console.error ( "Error generating upload URL:", error )
      return rep.status ( 500 ).send ( "Failed to generate URL." )
    }
  } )

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

  app.post ( "/delete", async ( req, rep ) => {
    const { key, isFolder } = req.body as { key?: string; isFolder?: boolean }

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key' for deletion." )
    }

    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

    try {
      let totalSizeDeleted = 0

      if ( isFolder ) {
        const files = await S3Service.listAllKeysUnderPrefix ( key )
        if ( files.length === 0 ) {
          return rep.status ( 200 ).send ( { message: "Folder is empty or already deleted." } )
        }

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
        const files = await S3Service.listAllKeysUnderPrefix ( oldKey )

        await Promise.all ( files.map ( file => S3Service.copyObject ( file.key, file.key.replace ( oldKey, newKey ) ) ) )

        await onFolderRenamed ( oldKey, newKey )

        await Promise.all ( files.map ( file => S3Service.deleteObject ( file.key ) ) )
      } else {
        await S3Service.copyObject ( oldKey, newKey )

        await onFileRenamed ( oldKey, newKey )

        await S3Service.deleteObject ( oldKey )
      }

      return rep.status ( 200 ).send ( { message: "Rename/Move successful." } )
    } catch ( error ) {
      console.error ( "Error renaming file:", error )
      return rep.status ( 500 ).send ( "Failed to rename file." )
    }
  } )

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

  app.get ( "/quota", async ( req, rep ) => {
    try {
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

  app.post ( "/upload-complete", async ( req, rep ) => {
    const { key, fileSize } = req.body as { key?: string; fileSize?: number }

    if ( !key ) {
      return rep.status ( 400 ).send ( "Missing 'key'." )
    }

    const userRef = getFirestore ( ).collection ( "users" ).doc ( req.user!.uid )

    try {
      const actualSize = await S3Service.getObjectSize ( key )
      const claimed = typeof fileSize === "number" && fileSize > 0 ? fileSize : actualSize

      if ( Math.abs ( actualSize - claimed ) > 1024 ) {
        return rep.status ( 400 ).send ( "File size mismatch." )
      }

      // Quota was reserved at upload-url time; correct to actual object size
      const delta = actualSize - claimed
      if ( delta !== 0 ) {
        await userRef.set ( { storageUsed: incrementValue ( delta ) }, { merge: true } )
      }

      return rep.status ( 200 ).send ( { message: "Quota updated." } )
    } catch ( error ) {
      console.error ( "Error updating quota:", error )
      return rep.status ( 500 ).send ( "Failed to update quota." )
    }
  } )

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

      // Relative so preview works on the current host (dev/prod), not a hardcoded domain
      const viewUrl = `/api/share/${shareId}`
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

    const docs = snapshot.docs
    for ( let i = 0; i < docs.length; i += 400 ) {
      const batch = db.batch ( )
      for ( const doc of docs.slice ( i, i + 400 ) ) {
        batch.delete ( doc.ref )
      }
      await batch.commit ( )
    }
    if ( docs.length > 0 ) {
      console.log ( `Cleaned up ${docs.length} expired shared links.` )
    }
  } catch ( error ) {
    console.error ( "Error cleaning up shared links:", error )
  }
}