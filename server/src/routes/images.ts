import { config } from "dotenv"
import { join, normalize, resolve } from "path"

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

const isDevMode = ( ) => process.env [ "DEV" ] === "true"

import sharp from "sharp"
import { createReadStream } from "fs"
import { FastifyPluginAsync } from "fastify"
import { stat } from "fs/promises"

const IMAGE_DIR = join ( process.cwd ( ), "../", "assets", "img", )

const SUPPORTED_FORMATS = [ "webp", "avif", "jpeg", "png" ]

sharp.cache ( !isDevMode ( ) )
sharp.concurrency ( isDevMode ( ) ? 1 : 4 )

export const router: FastifyPluginAsync = async app => {
  app.get ( "/*", async ( req, rep ) => {
    try {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const asset = req.params as { "*": string }
      const filename = asset [ "*" ]

      if ( !filename ) {
        return rep.status ( 400 ).send ( "Filename is required" )
      }

      const { w, h, f, q } = req.query as { w?: string; h?: string; f?: string; q?: string }

      const width = w ? parseInt ( w as string, 10 ) : null
      const height = h ? parseInt ( h as string, 10 ) : null
      const format = f && SUPPORTED_FORMATS.includes ( f ) ? f : "webp"
      const quality = q ? parseInt ( q as string, 10 ) : 80
      const safeFilename = normalize ( filename ).replace ( /^(\.\.(\/|\\|$))+/, "" )

      const inputPath = join ( IMAGE_DIR, safeFilename )

      // Check if image or mp4
      // Only allow mp4, jpg, jpeg, png, webp, avif
      const ext = filename.split ( "." ).pop ( )?.toLowerCase ( )

      if ( ext === "mp4" ) {
        const fileSize = ( await stat ( inputPath ) ).size
        const range = req.headers.range

        if ( range ) {
          const parts = range.replace ( /bytes=/, "" ).split ( "-" )
          const start = parseInt ( parts [ 0 ], 10 )
          const end = parts [ 1 ] ? parseInt ( parts [ 1 ], 10 ) : fileSize - 1
          const chunkSize = end - start + 1

          const file = createReadStream ( inputPath, { start, end } )

          // In Fastify, use .header() and return the stream directly
          return rep
            .code ( 206 )
            .headers ( {
              "content-range": `bytes ${start}-${end}/${fileSize}`,
              "accept-ranges": "bytes",
              "content-length": chunkSize,
              "content-type": "video/mp4"
            } )
            .send ( file )
        } else {
          const file = createReadStream ( inputPath )

          return rep
            .code ( 200 )
            .headers ( {
              "content-length": fileSize,
              "content-type": "video/mp4"
            } )
            .send ( file )
        }
      } else if ( !ext || ![ "jpg", "jpeg", "png", "webp", "avif" ].includes ( ext ) ) {
        return rep.status ( 400 ).send ( "Unsupported file type" )
      } else {
        // const lastModified = stats.mtime.toUTCString ( )

        rep.header ( "content-type", ext === "jpeg" ? "image/jpeg" : `image/${ext}` )
        rep.header ( "content-disposition", `inline; filename="${filename.replace ( /"/g, "" ).replace ( /\s/g, "_" )}"` )
        rep.header ( "cache-control", "public, max-age=31536000, immutable" )
        // rep.header ( "etag", cacheKey )
        // rep.header ( "last-modified", lastModified )

        const transformer = sharp ( inputPath )
          .resize ( width, height, { fit: "inside", withoutEnlargement: true } )

        const effort = isDevMode ( ) ? 1 : 4
        if ( format === "jpeg" ) transformer.jpeg ( { quality, progressive: true } )
        else if ( format === "png" ) transformer.png ( { quality, effort } )
        else if ( format === "avif" ) transformer.avif ( { quality, effort } )
        else transformer.webp ( { quality, effort } )

        return rep.status ( 200 ).send ( transformer )
      }
    } catch ( err ) {
      if ( err instanceof Error && "code" in err ) {
        if ( err.code === "ENOENT" ) {
          return rep.status ( 404 ).send ( "Image not found" )
        }
        if ( err.code === "EISDIR" ) {
          return rep.status ( 400 ).send ( "Invalid image path" )
        }
        if ( err.code === "EACCES" ) {
          return rep.status ( 403 ).send ( "Permission denied" )
        }
      }

      if ( isDevMode ( ) ) {
        console.error ( `Error processing image ${req.url}:`, err )
      }
      return rep.status ( 500 ).send ( "Error processing image" )
    }
  } )
}