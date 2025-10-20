import type { Request, Response } from "express"
import { Router } from "express"
import { rateLimit } from "express-rate-limit"

import { resolve } from "path"
import { config } from "dotenv"
import multer from "multer"
import NodeClam from "clamscan"
import { Readable } from "stream"
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3"
import { pool } from "../db.js"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireAuth } from "../middleware/requireAuth.js"
import { verifyToken } from "../auth.js"

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

export const router = Router ( )

// Map of allowed expiry options
const linkExpiryMap: Record<string, number> = {
  "1d": 86400,          // 1 day
  "1w": 86400 * 7,      // 1 week
  "1m": 86400 * 30,     // 1 month (approx)
  // "1y": 86400 * 365,    // 1 year
}

const Multer = multer ( {
  limits: {
    fileSize: 5.5 * 1024 * 1024 // 5.5 MB
  }
} )

if ( !process.env [ "R2_ACCESS_KEY_ID" ] || !process.env [ "R2_SECRET_ACCESS_KEY" ] || !process.env [ "R2_ACCOUNT_ID" ] || !process.env [ "R2_BUCKET_NAME" ] ) {
  console.error ( "❌ R2_ACCESS_KEY_ID; R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID and R2_BUCKET_NAME must be set in the .env file." )
  process.exit ( 1 )
}

const s3 = new S3Client ( {
  endpoint: `https://${process.env [ "R2_ACCOUNT_ID" ]}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env [ "R2_ACCESS_KEY_ID" ],
    secretAccessKey: process.env [ "R2_SECRET_ACCESS_KEY" ]
  }
} )

router.use ( rateLimit ( {
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    status: 429,
    message: "Too many requests, please try again later."
  }
} ) )

let ClamScan: NodeClam
try {
  console.log ( `Attempting to connect to ClamAV...` )

  const clamdscan: Record<string, any> | null = {
    host: "localhost",
    port: 3310,
    timeout: 60000,
    localFallback: true,
  }

  ClamScan = await ( new NodeClam ( ) ).init ( {
    removeInfected: true, // Removes files if they are infected
    quarantineInfected: false, // Move file here. removeInfected must be FALSE, though.
    scanLog: undefined, // You're a detail-oriented security professional.
    scanRecursively: false, // Choosing false here will save some CPU cycles,
    clamdscan,
    preference: "clamdscan", // If clamdscan is found and active, it will be used by default
  } )
  console.log ( "✅ ClamAV connection established." )
} catch ( error: any ) {
  console.error ( `❌ Failed to connect to ClamAV: ${error.message}` )
  throw "⛔ ClamAV is not available."
}

router.get ( "/", requireAuth, async ( req: Request, res: Response ) => {
  const accessToken = req.headers.authorization?.split ( " " ) [ 1 ] || ""

  const payload = await verifyToken ( accessToken, true, false )

  const files = await pool!.query ( `
  SELECT
    files.id AS id,
    files.name AS name,
    files.type AS type,
    files.size AS size,
    files.r2_path AS path,
    files.mime_type AS mime_type,
    files.created_at AS file_created_at,
    files.updated_at AS file_updated_at
  FROM files
  WHERE owned_by = $1
  `, [ payload?.sub || "" ] )

  const results = files.rows.map ( async file => {
    const links = await pool!.query ( `
      SELECT id, token, max_downloads, downloads_used, expires_at, created_at, updated_at
      FROM file_shares
      WHERE file_id = $1
    `, [ file.id ] )
    file.shares = links.rows
    return file
  } )

  res.json ( await Promise.all ( results ) )
} )

router.post ( "/upload", requireAuth, Multer.fields ( [
  { name: "files", maxCount: 10 },
  { name: "parentId", maxCount: 1 },
  { name: "parentPath", maxCount: 1 }
] ), async ( req: Request, res: Response ) => {
  const { files, body } = req // body may include parent folder ID
  const uploadFiles = Array.isArray ( files ) ? files : files?. [ "files" ] as Express.Multer.File [ ]

  if ( !uploadFiles || uploadFiles.length === 0 ) {
    res.status ( 400 ).json ( {
      message: "No file uploaded."
    } )
    return
  }

  if ( !Array.isArray ( uploadFiles ) ) {
    res.status ( 400 ).json ( {
      message: "Files must be an array."
    } )
    return
  }

  const totalSize = uploadFiles.reduce ( ( acc, file ) => acc + file.size, 0 )
  if ( totalSize > 20 * 1024 * 1024 ) {
    res.status ( 400 ).json ( { message: "Total upload size exceeds the 20MB limit." } )
    return
  }

  const results: any [ ] = [ ]
  // Allowed types
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png"
  ]

  for ( const file of uploadFiles ) {
    const relativePath = body.relativePath || ""
    if ( !allowedMimeTypes.includes ( file.mimetype ) ) {
      res.status ( 415 ).json ( { message: "Unsupported file type." } )
      return
    }

    // Check safety (basic check, e.g., no double extensions)
    const fileName = file.originalname
    if ( !fileName.match ( /^[^\\/:\*\?"<>\|]{1,255}\.[A-Za-z0-9]{2,10}$/ ) ) {
      res.status ( 400 ).json ( { message: "Invalid file name." } )
      return
    }

    if ( fileName.includes ( ".." ) || fileName.includes ( "/" ) || fileName.includes ( "\\" ) ) {
      res.status ( 400 ).json ( { message: "Invalid file name." } )
      return
    }

    // Check filename length
    if ( fileName.length > 255 ) {
      res.status ( 400 ).json ( { message: "File name is too long. Maximum length is 255 characters." } )
      return
    }

    if ( file.size > 5.5 * 1024 * 1024 ) {
      res.status ( 400 ).json ( { message: "File size exceeds the 5.5MB limit." } )
      return
    }

    // Check if file exists in the specified folder
    const existing = await pool!.query ( "SELECT * FROM files WHERE name = $1 AND r2_path = $2", [ file.originalname, relativePath ] )
    if ( existing.rows.length > 0 ) {
      res.status ( 409 ).json ( { message: `A file named ${file.originalname} already exists in the specified folder.` } )
      return
    }

    const buffer = file.buffer

    const { isInfected } = await ClamScan.scanStream ( Readable.from ( buffer ) )
    if ( isInfected ) {
      // 💣 nuke time
      res.status ( 400 ).json ( { message: "Uploaded file has been removed as it may be infected with some form of malware, please contact your system administrator for further help." } )
      return
    } else {
      console.log ( "✅ File scanned successfully, no threats found." )
    }

    const key = `${relativePath || ""}${file.originalname}`

    const accessToken = req.headers.authorization?.split ( " " ) [ 1 ] || ""
    const payload = await verifyToken ( accessToken, true, false )

    await s3.send (
      new PutObjectCommand ( {
        Bucket: process.env [ "R2_BUCKET_NAME" ],
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      } )
    )

    // Insert metadata in DB
    const result = await pool!.query (
      "INSERT INTO files (name, type, r2_path, size, mime_type, owned_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [ file.originalname, "file", key, file.size, file.mimetype, payload?.sub || "" ]
    )

    results.push ( {
      fileName,
      file: result.rows [ 0 ],
      message: "File uploaded successfully."
    } )
  }

  res.json ( results )
} )

router.post ( "/list", requireAuth, async ( req: Request, res: Response ) => {
  const { parentId } = req.body

  let result
  if ( parentId ) {
    result = await pool!.query ( "SELECT * FROM files WHERE parent_id = $1 ORDER BY type DESC, name ASC", [ parentId ] )
  } else {
    result = await pool!.query ( "SELECT * FROM files WHERE parent_id IS NULL ORDER BY type DESC, name ASC" )
  }

  res.json ( result.rows )
} )

router.delete ( "/:id", async ( req: Request, res: Response ) => {
  const { id } = req.params

  // Get file/folder info from DB
  const fileResult = await pool!.query ( "SELECT * FROM files WHERE id = $1", [ id ] )
  if ( fileResult.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "File or folder not found." } )
    return
  }

  const file = fileResult.rows [ 0 ]

  if ( file.type === "folder" ) {
    // Check if folder is empty
    const childResult = await pool!.query ( "SELECT COUNT(*) FROM files WHERE parent_id = $1", [ id ] )
    if ( Number ( childResult.rows [ 0 ].count ) > 0 ) {
      res.status ( 400 ).json ( { message: "Folder is not empty." } )
      return
    }
  }

  console.log ( file )
  // Delete from R2
  await s3.send (
    new DeleteObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      Key: file.r2_path
    } )
  )

  // Delete from DB
  await pool!.query ( "DELETE FROM files WHERE id = $1", [ id ] )

  res.json ( { message: "Deleted successfully." } )
} )

router.get ( "/download/:fileName", requireAuth, async ( req: Request, res: Response ) => {
  const id = req.query?. [ "id" ] as string

  if ( !id ) {
    res.status ( 400 ).json ( { message: "File ID is required." } )
    return
  }

  // Get file info from DB
  const fileResult = await pool!.query ( "SELECT * FROM files WHERE id = $1", [ id ] )
  if ( fileResult.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "File not found." } )
    return
  }

  const file = fileResult.rows [ 0 ]
  if ( file.type !== "file" ) {
    res.status ( 400 ).json ( { message: "Not a valid file." } )
    return
  }

  // fetch the file from R2 and stream it to the client
  const url = await getSignedUrl (
    s3,
    new GetObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      Key: file.r2_path
    } )
  )

  // If it's a folder, zip its contents and stream the zip
  if ( file.type === "folder" ) {
    // Get all files in the folder (non-recursive)
    const filesInFolder = await pool!.query (
      "SELECT * FROM files WHERE parent_id = $1 AND type = 'file'",
      [ file.id ]
    )

    if ( filesInFolder.rows.length === 0 ) {
      res.status ( 404 ).json ( { message: "Folder is empty." } )
      return
    }

    // Use archiver to zip files on the fly
    const archiver = ( await import ( "archiver" ) ).default
    res.setHeader ( "Content-Type", "application/zip" )
    res.setHeader ( "Content-Disposition", `attachment; filename="${file.name}.zip"` )

    const archive = archiver ( "zip", { zlib: { level: 9 } } )
    archive.on ( "error", err => {
      console.error ( "Archiver error:", err )
      res.status ( 500 ).end ()
    } )
    archive.pipe ( res )

    for ( const f of filesInFolder.rows ) {
      const fileUrl = await getSignedUrl (
        s3,
        new GetObjectCommand ( {
          Bucket: process.env["R2_BUCKET_NAME"],
          Key: f.r2_path
        } ),
        { expiresIn: 60 }
      )
      const r2res = await fetch ( fileUrl )
      if ( r2res.body ) {
        archive.append ( Readable.fromWeb ( r2res.body ), { name: f.name } )
      }
    }

    archive.finalize ()
    return
  }

  // stream file from url to client
  fetch ( url ).then ( r2res => {
    // List of viewable mime types in browser
    const viewableMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "text/plain",
      "text/html"
    ]

    if ( viewableMimeTypes.includes ( file.mime_type ) ) {
      res.setHeader ( "Content-Type", file.mime_type )
      res.setHeader ( "Content-Disposition", `inline; filename="${file.name}"` )
    } else {
      res.setHeader ( "Content-Type", file.mime_type )
      res.setHeader ( "Content-Disposition", `attachment; filename="${file.name}"` )
    }

    if ( r2res.body ) {
      Readable.fromWeb ( r2res.body ).pipe ( res )
    } else {
      res.status ( 500 ).json ( { message: "Failed to download file." } )
    }
  } ).catch ( err => {
    console.error ( "Error downloading file from R2:", err )
    res.status ( 500 ).json ( { message: "Failed to download file." } )
  } )
} )

router.post ( "/move", requireAuth, async ( req: Request, res: Response ) => {
  const { id, newParentId, newParentPath } = req.body

  if ( !id ) {
    res.status ( 400 ).json ( { message: "File or folder ID is required." } )
    return
  }

  // Get file/folder info from DB
  const fileResult = await pool!.query ( "SELECT * FROM files WHERE id = $1", [ id ] )
  if ( fileResult.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "File or folder not found." } )
    return
  }

  const file = fileResult.rows [ 0 ]
  const oldKey = file.r2_key
  const newKey = `${newParentPath || ""}/${file.name}${file.type === "folder" ? "/" : ""}`

  // Copy object to new location in R2
  await s3.send (
    new CopyObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      CopySource: `${process.env [ "R2_BUCKET_NAME" ]}/${oldKey}`,
      Key: newKey,
    } )
  )

  // Delete old object
  await s3.send (
    new DeleteObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      Key: oldKey
    } )
  )

  // Update DB
  await pool!.query ( "UPDATE files SET parent_id = $1, r2_key = $2 WHERE id = $3", [ newParentId || null, newKey, id ] )

  res.json ( { message: "Moved successfully." } )
} )

router.post ( "/rename", requireAuth, async ( req: Request, res: Response ) => {
  const { id, newName, parentPath } = req.body

  if ( !id || !newName || newName.trim ( ) === "" ) {
    res.status ( 400 ).json ( { message: "File or folder ID and new name are required." } )
    return
  }

  // Basic safety check
  if ( newName.split ( "/" ).length > 1 || newName.split ( "\\" ).length > 1 ) {
    res.status ( 400 ).json ( { message: "Invalid name." } )
    return
  }

  // Get file/folder info from DB
  const fileResult = await pool!.query ( "SELECT * FROM files WHERE id = $1", [ id ] )
  if ( fileResult.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "File or folder not found." } )
    return
  }

  const file = fileResult.rows [ 0 ]
  const oldKey = file.r2_path
  const newKey = `${parentPath || ""}/${newName}${file.type === "folder" ? "/" : ""}`

  // Copy object to new location in R2
  await s3.send (
    new CopyObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      CopySource: `${process.env [ "R2_BUCKET_NAME" ]}/${oldKey}`,
      Key: newKey,
      ContentType: file.type === "folder" ? "application/x-directory" : file.mime_type
    } )
  )

  // Delete old object
  await s3.send (
    new DeleteObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      Key: oldKey
    } )
  )

  // Update DB
  await pool!.query ( "UPDATE files SET name = $1, r2_path = $2 WHERE id = $3", [ newName, newKey, id ] )

  res.json ( { message: "Renamed successfully." } )
} )

/**
 * Create a share link
 */
router.post ( "/share", requireAuth, async ( req: Request, res: Response ) => {
  const { fileId, expiryOption, maxDownloads } = req.body

  if ( !fileId ) {
    res.status ( 400 ).json ( { message: "File ID is required." } )
    return
  }

  // Get file info
  const fileResult = await pool!.query ( "SELECT * FROM files WHERE id = $1", [ fileId ] )
  if ( fileResult.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "File not found." } )
    return
  }

  const file = fileResult.rows [ 0 ]
  if ( file.type !== "file" ) {
    res.status ( 400 ).json ( { message: "Only files can be shared." } )
    return
  }

  // Expiry
  const ttl = linkExpiryMap [ expiryOption ] || linkExpiryMap [ "1d" ]
  const expiresAt = new Date ( Date.now ( ) + ttl * 1000 )

  // Insert share record
  const result = await pool!.query (
    `INSERT INTO file_shares (file_id, max_downloads, expires_at)
     VALUES ($1, $2, $3) RETURNING id, token, max_downloads, expires_at, created_at`,
    [ fileId, maxDownloads || null, expiresAt ]
  )

  const share = result.rows [ 0 ]

  res.json ( {
    shareUrl: `https://revivescotland.co.uk/api/files/share/${share.token}`,
    expiresAt: share.expires_at,
    maxDownloads: share.max_downloads,
  } )
} )

/**
 * Access a share link
 */
router.get ( "/share/:token", async ( req: Request, res: Response ) => {
  const { token } = req.params

  const result = await pool!.query ( "SELECT * FROM file_shares WHERE token = $1", [ token ] )
  if ( result.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "Invalid or expired link." } )
    return
  }

  const share = result.rows [ 0 ]

  // Check expiry
  if ( share.expires_at && new Date ( ) > new Date ( share.expires_at ) ) {
    res.status ( 410 ).json ( { message: "Link expired." } )
    return
  }

  // Check downloads
  if ( share.max_downloads && share.downloads_used >= share.max_downloads ) {
    res.status ( 410 ).json ( { message: "Download limit reached." } )
    return
  }

  // Get file
  const fileResult = await pool!.query ( "SELECT * FROM files WHERE id = $1", [ share.file_id ] )
  if ( fileResult.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "File not found." } )
    return
  }

  const file = fileResult.rows [ 0 ]

  // Generate presigned URL (short-lived)
  const url = await getSignedUrl (
    s3,
    new GetObjectCommand ( {
      Bucket: process.env [ "R2_BUCKET_NAME" ],
      Key: file.r2_path,
    } ),
    { expiresIn: 60 } // presigned link lasts 1 min
  )

  // Increment downloads_used
  await pool!.query ( "UPDATE file_shares SET downloads_used = downloads_used + 1 WHERE id = $1", [ share.id ] )

  res.json ( {
    name: file.name,
    mimeType: file.mime_type,
    url,
    remainingDownloads: share.max_downloads
      ? share.max_downloads - ( share.downloads_used + 1 )
      : null,
    expiresAt: share.expires_at,
  } )
} )

/**
 * Revoke a share link
 */
router.delete ( "/share/:id", requireAuth, async ( req: Request, res: Response ) => {
  const { id } = req.params
  const result = await pool!.query ( "DELETE FROM file_shares WHERE id = $1 RETURNING *", [ id ] )

  if ( result.rows.length === 0 ) {
    res.status ( 404 ).json ( { message: "Share link not found." } )
    return
  }

  res.json ( { message: "Share link revoked successfully." } )
} )