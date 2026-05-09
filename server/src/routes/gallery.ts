import { join } from "path"
import { readdir } from "fs/promises"
import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "./admin.js"

const IMAGE_DIR = join ( process.cwd ( ), "../", "assets", "img", "gallery" )

const FOLDER_ORDER = [ "dunoon", "kinloss", "skye" ]

const sortFolders = ( names: string [ ] ): string [ ] => {
  const known = FOLDER_ORDER.filter ( n => names.includes ( n ) )
  const unknown = names.filter ( n => !FOLDER_ORDER.includes ( n ) ).sort ( )
  return [ ...known, ...unknown ]
}

const ALBUM_CACHE_TTL_MS = 60 * 1000 // 60 seconds

let albumCache: Record<string, string [ ]> | null = null
let albumCacheTime = 0

export const readAllAlbums = async ( ): Promise<Record<string, string [ ]>> => {
  if ( albumCache && Date.now ( ) - albumCacheTime < ALBUM_CACHE_TTL_MS ) {
    return albumCache
  }

  const entries = await readdir ( IMAGE_DIR, { withFileTypes: true } )
  const dirs = entries.filter ( e => e.isDirectory ( ) ).map ( e => e.name )
  const ordered = sortFolders ( dirs )

  const albums = await Promise.all ( ordered.map ( async name => {
    const files = await readdir ( join ( IMAGE_DIR, name ) )
    const media = files
      .filter ( f => /\.(jpg|jpeg|png|mp4)$/i.test ( f ) )
      .sort ( ( a, b ) => {
        const na = parseInt ( a.match ( /(\d+)\./ ) ?. [ 1 ] ?? "0", 10 )
        const nb = parseInt ( b.match ( /(\d+)\./ ) ?. [ 1 ] ?? "0", 10 )
        return na - nb
      } )
      .map ( f => `gallery/${name}/${f}` )
    return [ name, media ] as const
  } ) )

  const result = Object.fromEntries ( albums )

  albumCache = result
  albumCacheTime = Date.now ( )

  return result
}

interface GallerySettings {
  hiddenImages: string [ ]
  additionalImages: Record<string, string [ ]>
}

export const getGallerySettings = async ( ): Promise<GallerySettings> => {
  try {
    const doc = await getFirestore ( ).collection ( "site_content" ).doc ( "gallery-settings" ).get ( )
    const data = doc.exists ? doc.data ( ) as Partial<GallerySettings> : { }
    return {
      hiddenImages: data?.hiddenImages ?? [ ],
      additionalImages: data?.additionalImages ?? { }
    }
  } catch {
    return { hiddenImages: [ ], additionalImages: { } }
  }
}

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    try {
      const [ staticAlbums, settings ] = await Promise.all ( [ readAllAlbums ( ), getGallerySettings ( ) ] )
      const hiddenSet = new Set ( settings.hiddenImages )

      const result: Record<string, string [ ]> = { }
      const albumNames = Array.from ( new Set ( [ ...Object.keys ( staticAlbums ), ...Object.keys ( settings.additionalImages ) ] ) )

      for ( const name of albumNames ) {
        const staticImages = staticAlbums [ name ] ?? [ ]
        const additionalImages = settings.additionalImages [ name ] ?? [ ]
        const all = [ ...staticImages, ...additionalImages ]
        const visible = all.filter ( img => !hiddenSet.has ( img ) )
        if ( visible.length > 0 ) result [ name ] = visible
      }

      return rep.status ( 200 ).send ( result )
    } catch {
      return rep.status ( 500 ).send ( "Error listing gallery" )
    }
  } )
}
