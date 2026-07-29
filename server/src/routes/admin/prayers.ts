import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

export interface Prayer {
  id: string
  name: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  type: "devotional" | "intercessory" | "liturgical"
  text: string
  latin?: string
}

const VALID_CATEGORIES = [ "our-lady", "our-lord", "angels", "martyrs" ]
const VALID_TYPES = [ "devotional", "intercessory", "liturgical" ]

let prayersCache: { prayers: Prayer [ ] } | null = null
let cacheTime = 0
const TTL = 60000

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    try {
      if ( prayersCache && Date.now ( ) - cacheTime < TTL ) {
        return rep.send ( prayersCache )
      }

      const doc = await getFirestore ( ).collection ( "prayers" ).doc ( "default" ).get ( )

      if ( !doc.exists ) {
        return rep.status ( 200 ).send ( { prayers: [ ] } )
      }

      const data = ( doc.data ( ) as { prayers: Prayer [ ] } | undefined ) ?? { prayers: [ ] }
      prayersCache = data
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( data )
    } catch ( error ) {
      console.error ( "Error fetching prayers:", error )
      return rep.status ( 500 ).send ( { error: "Failed to fetch prayers." } )
    }
  } )

  app.post ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { prayers } = req.body as { prayers?: Prayer [ ] }

    if ( !prayers || !Array.isArray ( prayers ) ) {
      return rep.status ( 400 ).send ( { error: "Invalid prayer data format." } )
    }

    const sanitized: Prayer [ ] = prayers.map ( p => {
      const entry: Prayer = {
        id: String ( p.id || "" ).trim ( ),
        name: String ( p.name || "" ).substring ( 0, 100 ).trim ( ),
        category: ( VALID_CATEGORIES.includes ( p.category ) ? p.category : "our-lord" ) as Prayer [ "category" ],
        type: ( VALID_TYPES.includes ( p.type ) ? p.type : "devotional" ) as Prayer [ "type" ],
        text: String ( p.text || "" ).substring ( 0, 10000 ).trim ( )
      }
      if ( p.latin ) entry.latin = String ( p.latin ).substring ( 0, 10000 ).trim ( )
      return entry
    } )

    try {
      await getFirestore ( ).collection ( "prayers" ).doc ( "default" ).set ( { prayers: sanitized } )
      prayersCache = { prayers: sanitized }
      cacheTime = Date.now ( )
      return rep.status ( 200 ).send ( { message: "Prayers saved successfully." } )
    } catch ( error ) {
      console.error ( "Error saving prayers:", error )
      return rep.status ( 500 ).send ( { error: "Failed to save prayers." } )
    }
  } )

  app.delete ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { id } = req.body as { id?: string }

    if ( !id ) {
      return rep.status ( 400 ).send ( { error: "Missing prayer ID." } )
    }

    try {
      const doc = await getFirestore ( ).collection ( "prayers" ).doc ( "default" ).get ( )
      const data = ( doc.data ( ) as { prayers: Prayer [ ] } | undefined ) ?? { prayers: [ ] }
      const filtered = data.prayers.filter ( p => p.id !== id )

      await getFirestore ( ).collection ( "prayers" ).doc ( "default" ).set ( { prayers: filtered } )
      prayersCache = { prayers: filtered }
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( { message: "Prayer deleted successfully." } )
    } catch ( error ) {
      console.error ( "Error deleting prayer:", error )
      return rep.status ( 500 ).send ( { error: "Failed to delete prayer." } )
    }
  } )
}
