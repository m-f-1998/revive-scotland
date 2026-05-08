import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

export interface ContactDetails {
  phone: string
  email: string
  instagram: string
}

const DEFAULT: ContactDetails = {
  phone: "+447883824055",
  email: "luca@revivescotland.co.uk",
  instagram: "revive.scotland"
}

let cache: ContactDetails | null = null
let cacheTime = 0
const TTL = 60_000

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    if ( cache && Date.now ( ) - cacheTime < TTL ) {
      return rep.send ( cache )
    }

    try {
      const doc = await getFirestore ( ).collection ( "site_content" ).doc ( "contact" ).get ( )
      const data = ( doc.exists ? doc.data ( ) : DEFAULT ) as ContactDetails

      cache = data
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( data )
    } catch ( error ) {
      console.error ( "Error fetching contact details:", error )
      return rep.status ( 500 ).send ( "Failed to fetch contact details." )
    }
  } )

  app.post ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const body = req.body as Partial<ContactDetails>

    const phone = String ( body.phone || "" ).trim ( )
    const email = String ( body.email || "" ).trim ( )
    const instagram = String ( body.instagram || "" ).trim ( )

    if ( !phone || !email || !instagram ) {
      return rep.status ( 400 ).send ( "All fields are required." )
    }

    const data: ContactDetails = { phone, email, instagram }

    try {
      await getFirestore ( ).collection ( "site_content" ).doc ( "contact" ).set ( data )
      cache = data
      cacheTime = Date.now ( )
      return rep.status ( 200 ).send ( { message: "Contact details saved successfully." } )
    } catch ( error ) {
      console.error ( "Error saving contact details:", error )
      return rep.status ( 500 ).send ( "Failed to save contact details." )
    }
  } )
}
