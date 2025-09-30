import type { Request, Response } from "express"
import { Router } from "express"
import { rateLimit } from "express-rate-limit"

import { join, resolve } from "path"
import { config } from "dotenv"
import multer from "multer"
import { requireAuth } from "../middleware/requireAuth.js"
import { mkdir, readdir, stat, writeFile } from "fs/promises"
import sharp from "sharp"
import NodeClam from "clamscan"
import { isDevMode } from "../server.js"
import { Readable } from "stream"
import mime from "mime"

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

export const router = Router ( )

const Multer = multer ( ) // config settings here

// ✅ Adjust this to your actual image folder
const IMAGE_DIR = join ( process.cwd ( ), "../", "assets", "uploaded" )

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

router.get ( "/", async ( _: Request, res: Response ) => {
  try {
    // does directory exist?
    try {
      await stat ( IMAGE_DIR )
    } catch {
      res.status ( 200 ).json ( [ ] )
      return
    }
    const files = await readdir ( IMAGE_DIR )
    res.status ( 200 ).json ( await Promise.all ( files.map ( async x => {
      const stats = await stat ( join ( IMAGE_DIR, x ) )
      return {
        name: x,
        size: stats.size,
        type: mime.getType ( x ) || "application/octet-stream",
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      }
    } ) ) )
  } catch ( error ) {
    console.error ( error )
    console.error ( `❌ Failed to read image directory` )
    res.status ( 500 ).json ( { message: "⛔ Failed to retrieve files." } )
  }
} )

router.post ( "/", requireAuth, Multer.single ( "file" ), async ( req: Request, res: Response ) => {
  if ( !req.file ) {
    return res.status ( 400 ).json ( { message: "No file uploaded." } )
  }

  // Max 5.5mb
  const MAX_SIZE = 5.5 * 1024 * 1024
  if ( req.file.size > MAX_SIZE ) {
    return res.status ( 413 ).json ( { message: "File too large. Max 5.5MB allowed." } )
  }

  // Allowed types
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png"
  ]
  if ( !allowedMimeTypes.includes ( req.file.mimetype ) ) {
    return res.status ( 415 ).json ( { message: "Unsupported file type." } )
  }

  // Check safety (basic check, e.g., no double extensions)
  const fileName = req.file.originalname
  if ( fileName.split ( "." ).length > 2 ) {
    return res.status ( 400 ).json ( { message: "Invalid file name." } )
  }

  let ClamScan: NodeClam
  try {
    console.log ( `Attempting to connect to ClamAV...` )
    ClamScan = await ( new NodeClam ( ) ).init ( {
      removeInfected: true, // Removes files if they are infected
      quarantineInfected: false, // Move file here. removeInfected must be FALSE, though.
      scanLog: undefined, // You're a detail-oriented security professional.
      debugMode: isDevMode ( ), // This will put some debug info in your js console
      scanRecursively: false, // Choosing false here will save some CPU cycles
    } )
    console.log ( "✅ ClamAV connection established." )
  } catch ( error: any ) {
    console.error ( `❌ Failed to connect to ClamAV: ${error.message}` )
    return res.status ( 400 ).json ( { message: "⛔ ClamAV is not available." } )
  }

  const buffer = req.file.buffer

  const { isInfected } = await ClamScan.scanStream ( Readable.from ( buffer ) )
  if ( isInfected ) {
    // 💣 nuke time
    return res.status ( 400 ).json ( { message: "Uploaded file has been removed as it may be infected with some form of malware, please contact your system administrator for further help." } )
  } else {
    console.log ( "✅ File scanned successfully, no threats found." )
  }

  // Save file
  await mkdir ( IMAGE_DIR, { recursive: true } )

  const filePath = join ( IMAGE_DIR, fileName )

  if ( req.file.mimetype.startsWith ( "image/" ) ) {
    // Compress image
    const compressedBuffer = await sharp ( req.file.buffer )
      .jpeg ( { quality: 80 } )
      .toBuffer ()
    await writeFile ( filePath, compressedBuffer )
  } else {
    // Save as is
    await writeFile ( filePath, req.file.buffer )
  }

  return res.status ( 200 ).json ( { message: "File uploaded successfully." } )
} )