import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

const cache: Record<string, { data: unknown; time: number }> = { }
const TTL = 60_000

export const router: FastifyPluginAsync = async app => {
  app.get ( "/:section", async ( req, rep ) => {
    const { section } = req.params as { section: string }

    const cached = cache [ section ]
    if ( cached && Date.now ( ) - cached.time < TTL ) {
      return rep.send ( cached.data )
    }

    try {
      const doc = await getFirestore ( ).collection ( "site_content" ).doc ( section ).get ( )
      const data = doc.exists ? doc.data ( ) : { }

      cache [ section ] = { data, time: Date.now ( ) }
      return rep.status ( 200 ).send ( data )
    } catch ( error ) {
      console.error ( `Error fetching site content [${section}]:`, error )
      return rep.status ( 500 ).send ( "Failed to fetch content." )
    }
  } )

  app.post ( "/:section", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { section } = req.params as { section: string }
    const body = req.body as Record<string, unknown>

    if ( !body || typeof body !== "object" ) {
      return rep.status ( 400 ).send ( "Invalid request body." )
    }

    try {
      await getFirestore ( ).collection ( "site_content" ).doc ( section ).set ( body )
      cache [ section ] = { data: body, time: Date.now ( ) }
      return rep.status ( 200 ).send ( { message: `Content saved for section '${section}'.` } )
    } catch ( error ) {
      console.error ( `Error saving site content [${section}]:`, error )
      return rep.status ( 500 ).send ( "Failed to save content." )
    }
  } )
}
