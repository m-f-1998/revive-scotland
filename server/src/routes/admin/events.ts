import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

interface Event {
  id: string
  title: string
  description: string
  location: string
  imageUrl?: string
  startDate: string
  endDate: string

  actionType: "webpage" | "contact"
  webpageUrl?: string

  contactFormFields?: Record<string, object> [ ]
}

let eventsCache: { events: Event [ ] } | null = null
let cacheTime = 0

const TTL = 60000

export const router: FastifyPluginAsync = async app => {
  /**
   * GET /api/admin/events
   * Fetches the events data array
   */
  app.get ( "/", async ( _req, rep ) => {
    try {
      if ( eventsCache && Date.now ( ) - cacheTime < TTL ) {
        return rep.send ( eventsCache )
      }

      const eventsCollection = getFirestore ( ).collection ( "events" )
      const docRef = eventsCollection.doc ( "default" ) // Could be used to categorize by page in future
      const doc = await docRef.get ( )

      if ( !doc.exists ) {
        return rep.status ( 200 ).send ( { events: [ ] } )
      }

      const data = doc.data ( ) as {
        events: {
          id: string
          title: string
          description: string
          location: string
          imageUrl?: string
          startDate: string
          endDate: string

          actionType: "webpage" | "contact"
          webpageUrl?: string
        } [ ]
      } | undefined

      if ( data && Array.isArray ( data.events ) ) {
        const currentTime = new Date ( )

        data.events = data.events.filter ( event => {
          const eventEndDate = new Date ( event.endDate )
          if ( !isNaN ( eventEndDate.getTime ( ) ) ) {
            return eventEndDate >= currentTime
          }
          return true
        } )
      }

      eventsCache = data ?? { events: [] }
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( data || { events: [ ] } )
    } catch ( error ) {
      console.error ( "Error fetching events data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch events configuration." )
    }
  } )

  /**
   * POST /api/admin/events
   * Saves (overwrites) the entire events data array.
   */
  app.post ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { events } = req.body as { events?: Event [ ] }

    if ( !events || !Array.isArray ( events ) ) {
      return rep.status ( 400 ).send ( "Invalid Events Data Format" )
    }

    if ( !events.length ) {
      return rep.status ( 400 ).send ( "Events data cannot be empty." )
    }

    if ( events.some ( ( event: { title: string } ) => !event.title ) ) {
      return rep.status ( 400 ).send ( "All event entries must have a valid title." )
    }

    // Sanitize and validate fields (e.g., ensure titles are short, dates are valid)
    let sanitizedEvents: Event [ ] = [ ]
    try {
      sanitizedEvents = events.map ( event => {
        const model: Event = {
          id: event.id,
          title: String ( event.title || "" ).substring ( 0, 100 ),
          description: String ( event.description || "" ).substring ( 0, 500 ),
          location: String ( event.location || "" ).substring ( 0, 200 ),
          imageUrl: event.imageUrl ? String ( event.imageUrl ).trim ( ) : undefined,
          startDate: event.startDate,
          endDate: event.endDate,
          actionType: event.actionType === "contact" ? "contact" : "webpage"
        }
        if ( model.actionType === "contact" ) {
          if ( !Array.isArray ( event.contactFormFields ) || event.contactFormFields.length === 0 ) {
            throw "Contact form events must have at least one contact form field."
          }
          model.contactFormFields = Array.isArray ( event.contactFormFields )
            ? event.contactFormFields
            : [ ]
        }
        if ( model.actionType === "webpage" ) {
          if ( !event.webpageUrl ) {
            throw "Webpage events must have a webpage URL."
          }
          model.webpageUrl = String ( event.webpageUrl ).trim ( )
        }
        return model
      } )
    } catch ( error ) {
      console.error ( "Error processing events data:", error )
      return rep.status ( 400 ).send ( "Error processing events data." )
    }

    try {
      const eventsCollection = getFirestore ( ).collection ( "events" )
      const docRef = eventsCollection.doc ( "default" ) // Could be used to categorize by page in future

      // Save the entire object, overwriting previous data
      await docRef.set ( { events: sanitizedEvents } )
      eventsCache = { events: sanitizedEvents }

      const shared_links = getFirestore ( ).collection ( "shared_links" )
      const snapshot = await shared_links.where ( "type", "==", "hero_editor" ).get ( )

      snapshot.forEach ( async doc => {
        const id = doc.id
        const expectedUrlEnding = `/api/public/s/${id}`
        const isInHeroes = sanitizedEvents.some ( hero => {
          return hero.imageUrl?.endsWith ( expectedUrlEnding )
        } )

        const events = getFirestore ( ).collection ( "heroes" )
        const eventsSnapshot = ( ( await events.doc ( "home" ).get ( ) ).data ( )?. [ "heroes" ] || [ ] ) as {
          url?: string
        } [ ]
        const isInEvents = eventsSnapshot.some ( hero => {
          return hero.url && hero.url.endsWith ( expectedUrlEnding )
        } )

        if ( !isInHeroes && !isInEvents ) {
          await shared_links.doc ( id ).delete ( )
        }
      } )

      return rep.status ( 200 ).send ( { message: `Events data saved successfully.` } )
    } catch ( error ) {
      console.error ( "Error saving events data:", error )
      return rep.status ( 500 ).send ( "Failed to save events configuration." )
    }
  } )

  /**
   * DELETE /api/admin/events
   * Deletes the events data document.
   */
  app.delete ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { id } = req.body as { id?: string }

      if ( !id ) {
        return rep.status ( 400 ).send ( { error: "Missing parameter" } )
      }

      const docRef = getFirestore ( ).collection ( "events" ).doc ( "default" )
      const doc = await docRef.get ( )
      const data = doc.data ( )

      if ( !data?. [ "events" ] ) {
        return rep.status ( 404 ).send ( { error: "Events data not found" } )
      }

      const filtered = data [ "events" ].filter ( ( e: { id: string } ) => e.id !== id )

      await docRef.update ( { events: filtered } )

      eventsCache = { events: filtered }

      return rep.status ( 200 ).send ( { message: `Events data deleted successfully.` } )
    } catch ( error ) {
      console.error ( "Error deleting events data:", error )
      return rep.status ( 500 ).send ( "Failed to delete events configuration." )
    }
  } )
}