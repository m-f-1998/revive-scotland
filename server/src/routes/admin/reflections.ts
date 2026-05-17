import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

export interface Reflection {
  id: string
  title: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  youtubeId: string
}

const VALID_CATEGORIES = [ "our-lady", "our-lord", "angels", "martyrs" ]

let reflectionsCache: { reflections: Reflection [ ] } | null = null
let cacheTime = 0
const TTL = 60000

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    try {
      if ( reflectionsCache && Date.now ( ) - cacheTime < TTL ) {
        return rep.send ( reflectionsCache )
      }

      const doc = await getFirestore ( ).collection ( "reflections" ).doc ( "default" ).get ( )

      if ( !doc.exists ) {
        return rep.status ( 200 ).send ( { reflections: [ ] } )
      }

      const data = ( doc.data ( ) as { reflections: Reflection [ ] } | undefined ) ?? { reflections: [ ] }
      reflectionsCache = data
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( data )
    } catch ( error ) {
      console.error ( "Error fetching reflections:", error )
      return rep.status ( 500 ).send ( { error: "Failed to fetch reflections." } )
    }
  } )

  app.post ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { reflections } = req.body as { reflections?: Reflection [ ] }

    if ( !reflections || !Array.isArray ( reflections ) ) {
      return rep.status ( 400 ).send ( { error: "Invalid reflection data format." } )
    }

    const sanitized: Reflection [ ] = reflections.map ( r => ( {
      id: String ( r.id || "" ).trim ( ),
      title: String ( r.title || "" ).substring ( 0, 150 ).trim ( ),
      category: ( VALID_CATEGORIES.includes ( r.category ) ? r.category : "our-lord" ) as Reflection [ "category" ],
      youtubeId: String ( r.youtubeId || "" ).replace ( /[^a-zA-Z0-9_-]/g, "" ).substring ( 0, 20 )
    } ) )

    try {
      await getFirestore ( ).collection ( "reflections" ).doc ( "default" ).set ( { reflections: sanitized } )
      reflectionsCache = { reflections: sanitized }
      cacheTime = Date.now ( )
      return rep.status ( 200 ).send ( { message: "Reflections saved successfully." } )
    } catch ( error ) {
      console.error ( "Error saving reflections:", error )
      return rep.status ( 500 ).send ( { error: "Failed to save reflections." } )
    }
  } )

  app.delete ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { id } = req.body as { id?: string }

    if ( !id ) {
      return rep.status ( 400 ).send ( { error: "Missing reflection ID." } )
    }

    try {
      const doc = await getFirestore ( ).collection ( "reflections" ).doc ( "default" ).get ( )
      const data = ( doc.data ( ) as { reflections: Reflection [ ] } | undefined ) ?? { reflections: [ ] }
      const filtered = data.reflections.filter ( r => r.id !== id )

      await getFirestore ( ).collection ( "reflections" ).doc ( "default" ).set ( { reflections: filtered } )
      reflectionsCache = { reflections: filtered }
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( { message: "Reflection deleted successfully." } )
    } catch ( error ) {
      console.error ( "Error deleting reflection:", error )
      return rep.status ( 500 ).send ( { error: "Failed to delete reflection." } )
    }
  } )
}
