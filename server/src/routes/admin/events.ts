import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"
import { clearEventsCache } from "../events.js"
import Stripe from "stripe"
import { StripeService } from "../../services/stripe.service.js"
import { isDevMode } from "../static.js"

interface Event {
  id: string
  title: string
  description: string
  location: string
  imageUrl?: string
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string

  actionType: "webpage" | "form"
  webpageUrl?: string

  contactFormFields?: Record<string, object> [ ]

  donationRequired?: "none" | "optional" | "required"
  donationDescription?: string
  donationPrice?: number
  stripeProductId?: string
  stripePriceId?: string
}

let eventsCache: { events: Event [ ] } | null = null
let cacheTime = 0

const TTL = 60000

const filterActiveAndRecentEvents = ( events: Event [ ] ): Event [ ] => {
  const threeWeeksAgo = new Date ( )
  threeWeeksAgo.setDate ( threeWeeksAgo.getDate ( ) - 21 )

  return events.filter ( event => {
    const eventEndDate = new Date ( event.endDate )
    if ( !isNaN ( eventEndDate.getTime ( ) ) ) {
      return eventEndDate >= threeWeeksAgo
    }
    return true
  } )
}

const getAbsoluteImageUrl = ( url: string | undefined ): string | undefined => {
  if ( !url ) return undefined
  if ( url.startsWith ( "http" ) ) return url
  const host = "https://revivescotland.co.uk"
  let resolved = url
  if ( !url.startsWith ( "/" ) ) {
    if ( !url.includes ( "." ) && url.length > 20 ) {
      resolved = `/api/share/${url}`
    } else {
      resolved = `/api/img/${url}`
    }
  }
  return `${host}${resolved}`
}

export const router: FastifyPluginAsync = async app => {
  /**
   * GET /api/admin/events
   * Fetches all event documents
   */
  app.get ( "/", async ( _req, rep ) => {
    try {
      if ( eventsCache && Date.now ( ) - cacheTime < TTL ) {
        return rep.send ( eventsCache )
      }

      const eventsCollection = getFirestore ( ).collection ( "events" )
      const snapshot = await eventsCollection.get ( )

      let events: Event[] = [ ]

      // Fallback logic for legacy `default` document migration
      const legacyDoc = snapshot.docs.find ( doc => doc.id === "default" )
      if ( legacyDoc && legacyDoc.exists ) {
        const legacyData = legacyDoc.data ( ) as { events?: Event[] }
        if ( legacyData.events && Array.isArray ( legacyData.events ) ) {
          events = legacyData.events
        }
      } else {
        events = snapshot.docs.map ( doc => {
          const data = doc.data ( ) as Event
          return { ...data, actionType: data.actionType === "form" || ( data.actionType as string ) === "contact" ? "form" : "webpage" }
        } )
      }

      const eventsList = filterActiveAndRecentEvents ( events )

      eventsCache = { events: eventsList }
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( eventsCache )
    } catch ( error ) {
      console.error ( "Error fetching events data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch events configuration." )
    }
  } )

  app.get ( "/registrations", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { eventId } = req.query as { eventId: string }

      const registrationsRef = getFirestore ( ).collection ( "event_registrations" )
      const snapshot = await registrationsRef.where ( "eventId", "==", eventId ).get ( )

      const registrations = snapshot.docs.map ( doc => {
        const data = doc.data ( )
        return {
          id: doc.id,
          eventId: data["eventId"],
          eventTitle: data["eventTitle"],
          formData: data["formData"],
          status: data["status"],
          paymentIntent: data["paymentIntent"] || null,
          stripeInvoiceId: data["stripeInvoiceId"] || null,
          createdAt: data["createdAt"]?.toDate ?. ( )?.toISOString ( ) || null
        }
      } )

      registrations.sort ( ( a, b ) => {
        const timeA = a.createdAt ? new Date ( a.createdAt ).getTime ( ) : 0
        const timeB = b.createdAt ? new Date ( b.createdAt ).getTime ( ) : 0
        return timeB - timeA
      } )

      return rep.status ( 200 ).send ( { registrations } )
    } catch ( error ) {
      console.error ( "Error fetching registrations:", error )
      return rep.status ( 500 ).send ( "Failed to fetch registrations." )
    }
  } )

  /**
   * POST /api/admin/events/registrations/:id/pay-link
   * Generates a reusable Stripe Payment Link for a custom donation amount.
   */
  app.post ( "/registrations/:id/pay-link", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { id } = req.params as { id: string }
      const { amountPence, eventId, eventTitle } = req.body as { amountPence: number; eventId: string; eventTitle: string }

      if ( !id || !amountPence || !eventId ) {
        return rep.status ( 400 ).send ( { error: "Missing required fields." } )
      }

      const stripe = StripeService.getStripeInstance ( )
      if ( !stripe ) {
        if ( isDevMode ( ) ) {
          return rep.status ( 200 ).send ( { url: "https://sandbox.stripe.com/pay-link-simulated" } )
        }
        return rep.status ( 500 ).send ( { error: "Stripe is not configured." } )
      }

      // We need a product to attach to the price.
      // If we don't have one on hand, create a generic "Optional Donation" product.
      let productId: string
      const search = await stripe.products.search ( {
        query: `metadata['eventId']:'${eventId}' AND name~'Donation'`,
        limit: 1
      } )

      if ( search.data.length > 0 ) {
        productId = search.data[0].id
      } else {
        const product = await stripe.products.create ( {
          name: `Donation: ${eventTitle || "Event"}`,
          metadata: { eventId }
        } )
        productId = product.id
      }

      // Create an ad-hoc price
      const price = await stripe.prices.create ( {
        currency: "gbp",
        unit_amount: amountPence,
        product: productId,
      } )

      // Generate the reusable payment link
      const paymentLink = await stripe.paymentLinks.create ( {
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        metadata: {
          registrationId: id,
          eventId
        },
        after_completion: {
          type: "redirect",
          redirect: {
            url: `${process.env["HOST_URL"] || "https://revivescotland.co.uk"}/events?registration=success`
          }
        }
      } )

      return rep.status ( 200 ).send ( { url: paymentLink.url } )
    } catch ( error ) {
      console.error ( "Error generating custom payment link:", error )
      return rep.status ( 500 ).send ( "Failed to generate payment link." )
    }
  } )

  /**
   * DELETE /api/admin/events/registrations/:id
   * Deletes a registration and refunds any associated Stripe payment.
   */
  app.delete ( "/registrations/:id", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { id } = req.params as { id: string }
      if ( !id ) {
        return rep.status ( 400 ).send ( { error: "Missing registration id" } )
      }

      const db = getFirestore ( )
      const docRef = db.collection ( "event_registrations" ).doc ( id )
      const doc = await docRef.get ( )

      if ( !doc.exists ) {
        return rep.status ( 404 ).send ( { error: "Registration not found" } )
      }

      const data = doc.data ( ) || { }
      const paymentIntentId = data [ "paymentIntent" ] ? String ( data [ "paymentIntent" ] ) : ""
      const stripeInvoiceId = data [ "stripeInvoiceId" ] ? String ( data [ "stripeInvoiceId" ] ) : ""

      let refunded = false
      let refundId: string | null = null
      let invoiceVoided = false

      if ( paymentIntentId ) {
        try {
          const result = await StripeService.refundPaymentIntent ( paymentIntentId )
          if ( result ) {
            refunded = true
            refundId = result.refundId
          } else if ( process.env [ "STRIPE_SECRET_KEY" ] ) {
            return rep.status ( 500 ).send ( { error: "Stripe refund failed. Registration was not deleted." } )
          }
        } catch ( err ) {
          console.error ( "Stripe refund error:", err )
          return rep.status ( 500 ).send ( {
            error: err instanceof Error ? err.message : "Stripe refund failed. Registration was not deleted."
          } )
        }
      } else if ( stripeInvoiceId ) {
        // Unpaid donate-later invoice — void so they can't pay after removal
        invoiceVoided = await StripeService.voidInvoiceIfOpen ( stripeInvoiceId )
      }

      await docRef.delete ( )

      return rep.status ( 200 ).send ( {
        message: "Registration deleted.",
        refunded,
        refundId,
        invoiceVoided
      } )
    } catch ( error ) {
      console.error ( "Error deleting registration:", error )
      return rep.status ( 500 ).send ( { error: "Failed to delete registration." } )
    }
  } )

  /**
   * POST /api/admin/events
   * Saves events individually as documents.
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

    let stripe: Stripe | null = null
    if ( process.env [ "STRIPE_SECRET_KEY" ] ) {
      stripe = new Stripe ( process.env [ "STRIPE_SECRET_KEY" ] )
    }

    const sanitizedEvents: Event [ ] = [ ]
    try {
      for ( const event of events ) {
        const model: Event = {
          id: event.id || `event-${Date.now ( )}-${Math.floor ( Math.random ( ) * 1000 )}`,
          title: String ( event.title || "" ).substring ( 0, 100 ),
          description: String ( event.description || "" ).substring ( 0, 500 ),
          location: String ( event.location || "" ).substring ( 0, 200 ),
          startDate: event.startDate,
          endDate: event.endDate,
          actionType: event.actionType === "form" || ( event.actionType as string ) === "contact" ? "form" : "webpage"
        }

        if ( event.imageUrl ) model.imageUrl = String ( event.imageUrl ).trim ( )
        if ( event.startTime ) model.startTime = event.startTime
        if ( event.endTime ) model.endTime = event.endTime
        if ( event.donationRequired ) model.donationRequired = event.donationRequired
        if ( event.donationDescription ) model.donationDescription = String ( event.donationDescription ).substring ( 0, 500 )
        if ( event.donationPrice != null ) model.donationPrice = Number ( event.donationPrice )
        if ( event.stripeProductId ) model.stripeProductId = event.stripeProductId
        if ( event.stripePriceId ) model.stripePriceId = event.stripePriceId

        if ( model.actionType === "form" ) {
          if ( !Array.isArray ( event.contactFormFields ) || event.contactFormFields.length === 0 ) {
            throw "Registration form events must have at least one form field."
          }
          model.contactFormFields = Array.isArray ( event.contactFormFields ) ? event.contactFormFields : [ ]
        }
        if ( model.actionType === "webpage" ) {
          if ( !event.webpageUrl ) {
            throw "Webpage events must have a webpage URL."
          }
          model.webpageUrl = String ( event.webpageUrl ).trim ( )
        }

        // Stripe Product Creation
        if ( model.donationRequired && model.donationRequired !== "none" ) {
          if ( !stripe ) {
            throw "Stripe is not configured. Cannot create a donation-required event. Please add STRIPE_SECRET_KEY."
          }
          if ( model.donationPrice && !model.stripeProductId ) {
            const stripeImages = getAbsoluteImageUrl ( model.imageUrl ) ? [ getAbsoluteImageUrl ( model.imageUrl ) as string ] : undefined
            const product = await stripe.products.create ( {
              name: model.title,
              description: model.donationDescription || model.description,
              images: stripeImages
            } )
            const price = await stripe.prices.create ( {
              product: product.id,
              unit_amount: model.donationPrice,
              currency: "gbp",
            } )
            model.stripeProductId = product.id
            model.stripePriceId = price.id
          }
        }

        sanitizedEvents.push ( model )
      }
    } catch ( error ) {
      console.error ( "Error processing events data:", error )
      return rep.status ( 400 ).send ( typeof error === "string" ? error : "Error processing events data." )
    }

    try {
      const db = getFirestore ( )
      const eventsCollection = db.collection ( "events" )

      const batch = db.batch ( )

      // Handle legacy default doc if it exists
      const defaultDoc = await eventsCollection.doc ( "default" ).get ( )
      if ( defaultDoc.exists ) {
        batch.delete ( defaultDoc.ref )
      }

      // Read current events to find ones to delete
      const currentSnap = await eventsCollection.get ( )
      const currentIds = currentSnap.docs.filter ( d => d.id !== "default" ).map ( d => d.id )
      const incomingIds = sanitizedEvents.map ( e => e.id )

      // Delete events that were removed
      const idsToDelete = currentIds.filter ( id => !incomingIds.includes ( id ) )
      for ( const id of idsToDelete ) {
        batch.delete ( eventsCollection.doc ( id ) )
      }

      // Set new/updated events
      for ( const event of sanitizedEvents ) {
        batch.set ( eventsCollection.doc ( event.id ), event )
      }

      await batch.commit ( )

      eventsCache = { events: filterActiveAndRecentEvents ( sanitizedEvents ) }
      cacheTime = Date.now ( )
      clearEventsCache ( )

      const shared_links = db.collection ( "shared_links" )
      const snapshot = await shared_links.where ( "type", "==", "hero_editor" ).get ( )

      const heroesSnapshot = ( ( await db.collection ( "heroes" ).doc ( "home" ).get ( ) ).data ( )?. [ "heroes" ] || [ ] ) as { url?: string } [ ]

      await Promise.all ( snapshot.docs.map ( async doc => {
        const id = doc.id
        const expectedUrlEnding = `/api/share/${id}`
        const isInHeroes = sanitizedEvents.some ( hero => hero.imageUrl?.endsWith ( expectedUrlEnding ) )
        const isInEvents = heroesSnapshot.some ( hero => hero.url?.endsWith ( expectedUrlEnding ) )

        if ( !isInHeroes && !isInEvents ) {
          await shared_links.doc ( id ).delete ( )
        }
      } ) )

      return rep.status ( 200 ).send ( { message: `Events data saved successfully.` } )
    } catch ( error ) {
      console.error ( "Error saving events data:", error )
      return rep.status ( 500 ).send ( "Failed to save events configuration." )
    }
  } )

  /**
   * DELETE /api/admin/events
   * Deletes a specific event document.
   */
  app.delete ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { id } = req.body as { id?: string }

      if ( !id ) {
        return rep.status ( 400 ).send ( { error: "Missing parameter" } )
      }

      const db = getFirestore ( )
      const docRef = db.collection ( "events" ).doc ( id )
      const doc = await docRef.get ( )

      if ( !doc.exists ) {
        return rep.status ( 404 ).send ( { error: "Event not found" } )
      }

      const eventData = doc.data ( ) as Event

      // Cascade delete registrations
      const registrationsRef = db.collection ( "event_registrations" )
      const regsSnapshot = await registrationsRef.where ( "eventId", "==", id ).get ( )

      const batch = db.batch ( )
      batch.delete ( docRef )
      regsSnapshot.docs.forEach ( d => batch.delete ( d.ref ) )

      await batch.commit ( )

      // Deactivate Stripe Product if it exists
      if ( eventData.stripeProductId && process.env [ "STRIPE_SECRET_KEY" ] ) {
        const stripe = new Stripe ( process.env [ "STRIPE_SECRET_KEY" ] )
        await stripe.products.update ( eventData.stripeProductId, { active: false } ).catch ( ( ) => null )
      }

      if ( eventsCache ) {
        eventsCache.events = eventsCache.events.filter ( e => e.id !== id )
      }
      clearEventsCache ( )

      return rep.status ( 200 ).send ( { message: `Event deleted successfully.` } )
    } catch ( error ) {
      console.error ( "Error deleting event data:", error )
      return rep.status ( 500 ).send ( "Failed to delete event configuration." )
    }
  } )
}