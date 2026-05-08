import { join } from "path"
import { readdir } from "fs/promises"
import { FastifyPluginAsync } from "fastify"

const IMAGE_DIR = join ( process.cwd ( ), "../", "assets", "img", "gallery" )

const FOLDER_ORDER = [ "dunoon", "kinloss", "skye" ]

const sortFolders = ( names: string [ ] ): string [ ] => {
  const known = FOLDER_ORDER.filter ( n => names.includes ( n ) )
  const unknown = names.filter ( n => !FOLDER_ORDER.includes ( n ) ).sort ( )
  return [ ...known, ...unknown ]
}

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    try {
      const entries = await readdir ( IMAGE_DIR, { withFileTypes: true } )
      const dirs = entries.filter ( e => e.isDirectory ( ) ).map ( e => e.name )
      const ordered = sortFolders ( dirs )

      const result: Record<string, string [ ]> = { }

      for ( const name of ordered ) {
        const files = await readdir ( join ( IMAGE_DIR, name ) )
        const media = files
          .filter ( f => /\.(jpg|jpeg|png|mp4)$/i.test ( f ) )
          .sort ( ( a, b ) => {
            const na = parseInt ( a.match ( /(\d+)\./ ) ?. [ 1 ] ?? "0", 10 )
            const nb = parseInt ( b.match ( /(\d+)\./ ) ?. [ 1 ] ?? "0", 10 )
            return na - nb
          } )
          .map ( f => `gallery/${name}/${f}` )
        if ( media.length > 0 ) result [ name ] = media
      }

      return rep.status ( 200 ).send ( result )
    } catch {
      return rep.status ( 500 ).send ( "Error listing gallery" )
    }
  } )
}
