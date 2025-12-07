import { Router, Request, Response } from "express"
import { rateLimit } from "express-rate-limit"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

export const router = Router ( )

router.use ( rateLimit ( {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  keyGenerator: ( req: Request ) => {
    return req.user ? req.user.uid : ( req?.ip || "" )
  }
} ) )
/**
 * GET /api/admin/events
 * Fetches the events data array
 */
router.get ( "/", async ( _req: Request, res: Response ) => {
  try {
    const eventsCollection = getFirestore ( ).collection ( "events" )
    const docRef = eventsCollection.doc ( "default" ) // Could be used to categorize by page in future
    const doc = await docRef.get ( )

    if ( !doc.exists ) {
      return res.json ( { events: [ ] } )
    }

    const data = doc.data ( ) as { events: any [ ] } | undefined

    if ( data && Array.isArray ( data.events ) ) {
      const currentTime = new Date ( )

      data.events = data.events.filter ( ( event: { endDate: string } ) => {
        if ( typeof event.endDate === "string" ) {
          const eventEndDate = new Date ( event.endDate )
          if ( !isNaN ( eventEndDate.getTime ( ) ) ) {
            return eventEndDate >= currentTime
          }
        }
        return true
      } )
    }

    await docRef.set ( data || { events: [ ] } )

    return res.json ( data || { events: [ ] } )
  } catch ( error ) {
    console.error ( "Error fetching events data:", error )
    return res.status ( 500 ).send ( "Failed to fetch events configuration." )
  }
} )

/**
 * POST /api/admin/events
 * Saves (overwrites) the entire events data array.
 */
router.post ( "/", checkFirebaseAuth, async ( req: Request, res: Response ) => {
  const eventsData = req.body

  if ( !eventsData || !Array.isArray ( eventsData.events ) ) {
    return res.status ( 400 ).json ( "Invalid Events Data Format" )
  }

  if ( !eventsData.events.length ) {
    return res.status ( 400 ).send ( "Events data cannot be empty." )
  }

  if ( eventsData.events.some ( ( event: { title: string } ) => !event.title ) ) {
    return res.status ( 400 ).send ( "All event entries must have a valid title." )
  }

  // Sanitize and validate fields (e.g., ensure titles are short, dates are valid)
  let sanitizedEvents: any [ ] = [ ]
  try {
    sanitizedEvents = eventsData.events.map ( ( event: {
      id: string
      title: string
      description: string
      location: string
      imageUrl?: string
      startDate: Date
      endDate: Date

      actionType: "webpage" | "contact"
      webpageUrl?: string

      contactFormFields?: any [ ]
    } ) => {
      const model: any = {
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
    return res.status ( 400 ).send ( error )
  }

  try {
    const eventsCollection = getFirestore ( ).collection ( "events" )
    const docRef = eventsCollection.doc ( "default" ) // Could be used to categorize by page in future

    // Save the entire object, overwriting previous data
    await docRef.set ( { events: sanitizedEvents } )

    return res.status ( 200 ).send ( { message: `Events data saved successfully.` } )
  } catch ( error ) {
    console.error ( "Error saving events data:", error )
    return res.status ( 500 ).send ( "Failed to save events configuration." )
  }
} )

/**
 * DELETE /api/admin/events
 * Deletes the events data document.
 */
router.delete ( "/", checkFirebaseAuth, async ( _req: Request, res: Response ) => {
  try {
    const eventsCollection = getFirestore ( ).collection ( "events" )
    const docRef = eventsCollection.doc ( "default" ) // Could be used to categorize by page in future

    await docRef.delete ( )

    return res.status ( 200 ).send ( { message: `Events data deleted successfully.` } )
  } catch ( error ) {
    console.error ( "Error deleting events data:", error )
    return res.status ( 500 ).send ( "Failed to delete events configuration." )
  }
} )