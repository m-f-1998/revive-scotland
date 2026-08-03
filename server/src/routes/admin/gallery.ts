import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { readAllAlbums, getGallerySettings } from "../gallery.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"
import { S3Service } from "../../services/s3.service.js"

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", { preHandler: checkFirebaseAuth }, async ( _req, rep ) => {
    try {
      const [ staticAlbums, settings ] = await Promise.all ( [ readAllAlbums ( ), getGallerySettings ( ) ] )

      const albumNames = Array.from ( new Set ( [ ...Object.keys ( staticAlbums ), ...Object.keys ( settings.additionalImages ) ] ) )
      const albums: Record<string, { static: string [ ]; additional: string [ ] }> = { }

      for ( const name of albumNames ) {
        albums [ name ] = {
          static: staticAlbums [ name ] ?? [ ],
          additional: settings.additionalImages [ name ] ?? [ ]
        }
      }

      return rep.status ( 200 ).send ( {
        albums,
        hiddenImages: settings.hiddenImages,
        additionalImages: settings.additionalImages
      } )
    } catch {
      return rep.status ( 500 ).send ( "Error loading gallery admin data" )
    }
  } )

  app.post ( "/settings", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { hiddenImages, additionalImages } = req.body as {
      hiddenImages: string [ ]
      additionalImages: Record<string, string [ ]>
    }

    if ( !Array.isArray ( hiddenImages ) || typeof additionalImages !== "object" ) {
      return rep.status ( 400 ).send ( "Invalid request body" )
    }

    try {
      await getFirestore ( ).collection ( "site_content" ).doc ( "gallery-settings" ).set ( { hiddenImages, additionalImages } )
      return rep.status ( 200 ).send ( { message: "Gallery settings saved" } )
    } catch {
      return rep.status ( 500 ).send ( "Error saving gallery settings" )
    }
  } )

  app.delete ( "/orphaned/:id", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { id } = req.params as { id: string }
    try {
      const db = getFirestore ( )
      const doc = await db.collection ( "shared_links" ).doc ( id ).get ( )
      if ( doc.exists ) {
        const data = doc.data ( )
        if ( data && data [ "key" ] ) {
          // Attempt to delete from S3
          await S3Service.deleteObject ( data [ "key" ] ).catch ( () => null )
        }
        await doc.ref.delete ( )
      }
      return rep.status ( 200 ).send ( { message: "Deleted" } )
    } catch {
      return rep.status ( 500 ).send ( "Error deleting orphaned file" )
    }
  } )
}
