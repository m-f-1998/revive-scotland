import type { Request, Response } from "express"
import { Router } from "express"

import { rateLimit } from "express-rate-limit"

import sharp from "sharp"
import { join } from "path"
import fs from "fs"
import { cpus } from "os"

export const router = Router ( )

router.use ( rateLimit ( {
  windowMs: 60 * 1000, // 1 minute
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    status: 429,
    message: "Too many requests, please try again later."
  }
} ) )

// ✅ Adjust this to your actual image folder
const IMAGE_DIR = join ( process.cwd ( ), "../", "assets", "img", )

// ✅ Supported formats
const SUPPORTED_FORMATS = [ "webp", "avif", "jpeg", "png" ]

sharp.cache ( true ) // Enable sharp cache
sharp.concurrency ( cpus ( ).length )

router.get ( "/:filename", ( req: Request, res: Response ) => {
  try {
    const { filename } = req.params
    const { w, h, f, q } = req.query

    const width = w ? parseInt ( w as string, 10 ) : null
    const height = h ? parseInt ( h as string, 10 ) : null
    const format = SUPPORTED_FORMATS.includes ( f as string ) ? ( f as string ) : "webp"
    const quality = q ? parseInt ( q as string, 10 ) : 60

    // ✅ Path to original image
    const inputPath = join ( IMAGE_DIR, filename )
    if ( !fs.existsSync ( inputPath ) ) {
      console.log ( "Image not found:", inputPath )
      res.status ( 404 ).send ( "Image not found" )
      return
    }

    // ✅ Sharp pipeline
    let transformer = sharp ( inputPath )
      .resize ( width, height, { fit: "inside", withoutEnlargement: true } )

    switch ( format ) {
      case "jpeg":
        transformer = transformer.jpeg ( { quality, progressive: true } )
        break
      case "png":
        transformer = transformer.png ( { quality } )
        break
      case "avif":
        transformer = transformer.avif ( { quality } )
        break
      default:
        transformer = transformer.webp ( { quality } )
    }

    res.type ( format )
    transformer.pipe ( res )
  } catch ( err ) {
    console.error ( err )
    res.status ( 500 ).send ( "Error processing image" )
  }
} )