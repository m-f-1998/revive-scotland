import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "./admin.js"
import Stripe from "stripe"
import { FieldValue } from "firebase-admin/firestore"
import { RecaptchaService } from "../services/recaptcha.service.js"
import { StripeService } from "../services/stripe.service.js"

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
  actionType: "webpage" | "contact"
  webpageUrl?: string
  contactFormFields?: Record<string, object> [ ]
  donationRequired?: "none" | "optional" | "required"
  donationDescription?: string
  donationPrice?: number
  stripeProductId?: string
  stripePriceId?: string
}

let eventsCache: Event [ ] | null = null
let cacheTime = 0
const TTL = 60000

export const filterActiveAndRecentEvents = ( events: Event [ ] ): Event [ ] => {
  const threeWeeksAgo = new Date ( )
  threeWeeksAgo.setDate ( threeWeeksAgo.getDate ( ) - 21 )

  return events.filter ( event => {
    const eventEndDate = new Date ( event.endDate )
    if ( !isNaN ( eventEndDate.getTime ( ) ) ) {
      return eventEndDate >= threeWeeksAgo
    }
    return true
  } ).sort ( ( a, b ) => new Date ( a.startDate ).getTime ( ) - new Date ( b.startDate ).getTime ( ) )
}

const resolveImageUrl = ( url: string | undefined ): string | undefined => {
  if ( !url ) return undefined
  if ( url.startsWith ( "http" ) || url.startsWith ( "/" ) ) return url
  if ( !url.includes ( "." ) && url.length > 20 ) return `/api/share/${url}`
  return `/api/img/${url}`
}

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    try {
      if ( eventsCache && Date.now ( ) - cacheTime < TTL ) {
        return rep.send ( { events: eventsCache } )
      }

      const eventsCollection = getFirestore ( ).collection ( "events" )
      const snapshot = await eventsCollection.get ( )

      let events: Event[] = []

      // Fallback logic for legacy `default` document migration
      const legacyDoc = snapshot.docs.find ( doc => doc.id === "default" )
      if ( legacyDoc && legacyDoc.exists ) {
        const legacyData = legacyDoc.data ( ) as { events?: Event[] }
        if ( legacyData.events && Array.isArray ( legacyData.events ) ) {
          events = legacyData.events
        }
      } else {
        events = snapshot.docs.map ( doc => doc.data ( ) as Event )
      }

      const activeEvents = filterActiveAndRecentEvents ( events ).map ( e => ( {
        ...e,
        imageUrl: resolveImageUrl ( e.imageUrl )
      } ) )

      eventsCache = activeEvents
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( { events: eventsCache } )
    } catch ( error ) {
      console.error ( "Error fetching events data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch events configuration." )
    }
  } )

  app.get ( "/:id", async ( req, rep ) => {
    try {
      const { id } = req.params as { id: string }
      if ( !id ) {
        return rep.status ( 400 ).send ( { error: "Missing event ID" } )
      }

      const doc = await getFirestore ( ).collection ( "events" ).doc ( id ).get ( )

      if ( !doc.exists ) {
        return rep.status ( 404 ).send ( { error: "Event not found" } )
      }

      const event = doc.data ( ) as Event
      event.imageUrl = resolveImageUrl ( event.imageUrl )

      return rep.status ( 200 ).send ( event )
    } catch ( error ) {
      console.error ( "Error fetching specific event data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch event." )
    }
  } )

  app.post ( "/:eventId/register", async ( req, rep ) => {
    const { eventId } = req.params as { eventId: string }
    const formData = req.body as Record<string, unknown>
    const recaptchaToken = formData?.["recaptchaToken"] as string | undefined

    if ( !recaptchaToken ) {
      return rep.status ( 400 ).send ( { message: "reCAPTCHA token missing." } )
    }

    try {
      await RecaptchaService.verifyToken ( recaptchaToken )
    } catch ( err ) {
      console.error ( "reCAPTCHA verification error:", err )
      return rep.status ( 500 ).send ( { message: "reCAPTCHA verification error." } )
    }

    delete formData [ "recaptchaToken" ]

    // Because events are now individual documents, we query the specific event directly
    const eventDoc = await getFirestore ( ).collection ( "events" ).doc ( eventId ).get ( )

    if ( !eventDoc.exists ) {
      // Fallback check against legacy 'default' array just in case migrations are partial
      const defaultDoc = await getFirestore ( ).collection ( "events" ).doc ( "default" ).get ( )
      const eventInArray = ( defaultDoc.data ( )?. [ "events" ] || [] ).find ( ( e: { id: string } ) => e.id === eventId )
      if ( !eventInArray ) {
        return rep.status ( 404 ).send ( { message: "Event not found." } )
      }
    }

    const event = eventDoc.exists ? eventDoc.data ( ) as Event : ( await getFirestore ( ).collection ( "events" ).doc ( "default" ).get ( ) ).data ( )?.["events"]?.find ( ( e: { id: string } ) => e.id === eventId )

    const registrationRef = getFirestore ( ).collection ( "event_registrations" ).doc ( )

    let stripeUrl: string | undefined

    if ( event.donationRequired && event.donationRequired !== "none" && event.stripePriceId ) {
      stripeUrl = await StripeService.createEventCheckoutSession (
        eventId,
        event.stripePriceId,
        registrationRef.id
      )
    }

    await registrationRef.set ( {
      eventId,
      eventTitle: event.title,
      formData,
      status: stripeUrl ? "pending_payment" : "completed",
      createdAt: FieldValue.serverTimestamp ( )
    } )

    return rep.send ( { 
      message: "Registration recorded.",
      checkoutUrl: stripeUrl
    } )
  } )

  app.post ( "/stripe/webhook", async ( req, rep ) => {
    const sig = req.headers [ "stripe-signature" ] as string

    if ( !sig ) {
      return rep.status ( 400 ).send ( "Missing Stripe signature" )
    }

    let event: Stripe.Event
    const body = JSON.stringify ( req.body )

    try {
      event = StripeService.constructWebhookEvent ( body, sig )
    } catch ( err ) {
      console.error ( "Webhook Error:", err )
      return rep.status ( 400 ).send ( `Webhook Error` )
    }

    if ( event.type === "checkout.session.completed" ) {
      const session = event.data.object as Stripe.Checkout.Session
      if ( session.client_reference_id ) {
        await getFirestore ( ).collection ( "event_registrations" ).doc ( session.client_reference_id ).update ( {
          status: "completed",
          paymentIntent: session.payment_intent
        } )
      }
    }

    return rep.send ( { received: true } )
  } )
}