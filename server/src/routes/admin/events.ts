import { FastifyPluginAsync } from "fastify"
import { FieldValue, WriteBatch } from "firebase-admin/firestore"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"
import { clearEventsCache, checkoutDraftIdFor } from "../events.js"
import { StripeService } from "../../services/stripe.service.js"
import { isDevMode } from "../static.js"
import {
  ensureDefaultOrganization,
  eventOrganizationId,
  getDefaultOrganizationId,
  resolveOrganizationById,
  userCanAccessOrganization
} from "../../services/organization.service.js"

const PUBLIC_DOMAIN = process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk"
const FIRESTORE_BATCH_LIMIT = 400

interface Event {
  id: string
  title: string
  description: string
  longDescription?: string
  location: string
  imageUrl?: string
  startDate?: string
  endDate?: string
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
  maxAttendees?: number
  waitlistEnabled?: boolean
  comingSoon?: boolean
  organizationId?: string
}

let eventsCache: { events: Event [ ] } | null = null
let cacheTime = 0

const TTL = 60000

const getAbsoluteImageUrl = ( url: string | undefined ): string | undefined => {
  if ( !url ) return undefined
  if ( url.startsWith ( "http" ) ) return url
  let resolved = url
  if ( !url.startsWith ( "/" ) ) {
    if ( !url.includes ( "." ) && url.length > 20 ) {
      resolved = `/api/share/${url}`
    } else {
      resolved = `/api/img/${url}`
    }
  }
  return `${PUBLIC_DOMAIN}${resolved}`
}

const registrantNameFromData = ( data: Record<string, unknown> ): string | null => {
  const direct = String ( data [ "name" ] || "" ).trim ( )
  if ( direct ) return direct
  const form = ( data [ "formData" ] || { } ) as Record<string, unknown>
  const fromForm = String (
    form [ "name" ] || form [ "Name" ] || form [ "firstName" ] || form [ "First Name" ] || ""
  ).trim ( )
  return fromForm || null
}

const amountPenceFromRegistration = ( data: Record<string, unknown> ): number | null => {
  if ( data [ "amountPence" ] != null && Number.isFinite ( Number ( data [ "amountPence" ] ) ) ) {
    return Number ( data [ "amountPence" ] )
  }
  const form = ( data [ "formData" ] || { } ) as Record<string, unknown>
  const custom = form [ "customDonationAmount" ]
  if ( custom == null || !Number.isFinite ( Number ( custom ) ) ) return null
  const n = Number ( custom )
  return n >= 50 ? Math.round ( n ) : Math.round ( n * 100 )
}

const countRegistrationsByEventId = async ( db: ReturnType<typeof getFirestore> ): Promise<Record<string, number>> => {
  const counts: Record<string, number> = { }
  const snap = await db.collection ( "event_registrations" ).select ( "eventId", "status" ).get ( )
  snap.docs.forEach ( doc => {
    const data = doc.data ( )
    const status = String ( data [ "status" ] || "" )
    if ( status !== "completed" && status !== "waitlist" ) return
    const id = String ( data [ "eventId" ] || "" ).trim ( )
    if ( !id ) return
    counts [ id ] = ( counts [ id ] || 0 ) + 1
  } )
  return counts
}

const runBatchedWrites = async ( ops: ( ( batch: WriteBatch ) => void ) [ ] ): Promise<void> => {
  const db = getFirestore ( )
  for ( let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT ) {
    const batch = db.batch ( )
    for ( const op of ops.slice ( i, i + FIRESTORE_BATCH_LIMIT ) ) {
      op ( batch )
    }
    await batch.commit ( )
  }
}

export const router: FastifyPluginAsync = async app => {
  /**
   * GET /api/admin/events
   * Fetches all event documents
   */
  app.get ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const admin = req.adminUser
      const db = getFirestore ( )
      await ensureDefaultOrganization ( ).catch ( ( ) => null )
      const registrationCounts = await countRegistrationsByEventId ( db )

      if ( eventsCache && Date.now ( ) - cacheTime < TTL ) {
        const events = admin
          ? eventsCache.events.filter ( e =>
            userCanAccessOrganization ( admin.role, admin.organizationIds, eventOrganizationId ( e ) )
          )
          : eventsCache.events
        return rep.send ( {
          events,
          registrationCounts,
          stripeLivemode: StripeService.isLivemode ( )
        } )
      }

      const eventsCollection = db.collection ( "events" )
      const snapshot = await eventsCollection.get ( )

      let events: Event[] = [ ]

      const individualDocs = snapshot.docs.filter ( doc => doc.id !== "default" )
      if ( individualDocs.length > 0 ) {
        events = individualDocs.map ( doc => {
          const data = doc.data ( ) as Event
          return { ...data, actionType: data.actionType === "form" || ( data.actionType as string ) === "contact" ? "form" : "webpage" }
        } )
      } else {
        // Legacy single-document format (`events/default` with an embedded array)
        const legacyDoc = snapshot.docs.find ( doc => doc.id === "default" )
        if ( legacyDoc?.exists ) {
          const legacyData = legacyDoc.data ( ) as { events?: Event[] }
          if ( legacyData.events && Array.isArray ( legacyData.events ) ) {
            events = legacyData.events
          }
        }
      }

      if ( admin ) {
        events = events.filter ( e =>
          userCanAccessOrganization ( admin.role, admin.organizationIds, eventOrganizationId ( e ) )
        )
      }

      eventsCache = { events }
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( {
        events,
        registrationCounts,
        stripeLivemode: StripeService.isLivemode ( )
      } )
    } catch ( error ) {
      console.error ( "Error fetching events data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch events configuration." )
    }
  } )

  app.get ( "/registrations", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { eventId } = req.query as { eventId: string }
      if ( !eventId ) {
        return rep.status ( 400 ).send ( { error: "Missing eventId" } )
      }

      const db = getFirestore ( )
      const [ regsSnapshot, draftsSnapshot ] = await Promise.all ( [
        db.collection ( "event_registrations" ).where ( "eventId", "==", eventId ).get ( ),
        db.collection ( "event_checkout_drafts" ).where ( "eventId", "==", eventId ).get ( )
      ] )

      const registrations = regsSnapshot.docs.map ( doc => {
        const data = doc.data ( ) as Record<string, unknown>
        return {
          id: doc.id,
          kind: "registration" as const,
          eventId: data [ "eventId" ],
          eventTitle: data [ "eventTitle" ],
          formData: data [ "formData" ],
          email: data [ "email" ] || null,
          name: registrantNameFromData ( data ),
          status: data [ "status" ],
          attended: data [ "attended" ] === true,
          paymentIntent: data [ "paymentIntent" ] || null,
          stripeInvoiceId: data [ "stripeInvoiceId" ] || null,
          amountPence: amountPenceFromRegistration ( data ),
          createdAt: ( data [ "createdAt" ] as { toDate?: ( ) => Date } | undefined )?.toDate ?. ( )?.toISOString ( ) || null
        }
      } )

      const drafts = draftsSnapshot.docs
        .filter ( doc => doc.data ( )?. [ "finalized" ] !== true )
        .map ( doc => {
          const data = doc.data ( )
          return {
            id: doc.id,
            kind: "draft" as const,
            eventId: data [ "eventId" ],
            eventTitle: data [ "eventTitle" ],
            formData: data [ "formData" ] || { },
            email: data [ "email" ] || null,
            name: data [ "name" ] || null,
            status: "awaiting_payment",
            amountPence: data [ "amountPence" ] ?? null,
            checkoutUrl: data [ "checkoutUrl" ] || null,
            donateLaterUrl: data [ "donateLaterUrl" ] || null,
            stripeInvoiceId: data [ "stripeInvoiceId" ] || null,
            paymentIntent: null,
            createdAt: data [ "createdAt" ]?.toDate ?. ( )?.toISOString ( ) || null
          }
        } )

      const combined = [ ...registrations, ...drafts ]
      combined.sort ( ( a, b ) => {
        const timeA = a.createdAt ? new Date ( a.createdAt ).getTime ( ) : 0
        const timeB = b.createdAt ? new Date ( b.createdAt ).getTime ( ) : 0
        return timeB - timeA
      } )

      return rep.status ( 200 ).send ( { registrations: combined } )
    } catch ( error ) {
      console.error ( "Error fetching registrations:", error )
      return rep.status ( 500 ).send ( "Failed to fetch registrations." )
    }
  } )

  /**
   * DELETE /api/admin/events/checkout-drafts/:id
   * Voids any open invoice, expires Checkout, and removes an unpaid draft.
   */
  app.delete ( "/checkout-drafts/:id", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { id } = req.params as { id: string }
      if ( !id ) {
        return rep.status ( 400 ).send ( { error: "Missing draft id" } )
      }

      const draftRef = getFirestore ( ).collection ( "event_checkout_drafts" ).doc ( id )
      const draftSnap = await draftRef.get ( )
      if ( !draftSnap.exists ) {
        return rep.status ( 404 ).send ( { error: "Draft not found" } )
      }

      const data = draftSnap.data ( ) || { }
      if ( data [ "finalized" ] === true ) {
        return rep.status ( 400 ).send ( { error: "Draft already finalized into a registration." } )
      }

      if ( data [ "stripeInvoiceId" ] ) {
        await StripeService.voidInvoiceIfOpen ( String ( data [ "stripeInvoiceId" ] ) )
      }
      if ( data [ "stripeCheckoutSessionId" ] ) {
        await StripeService.expireCheckoutSession ( String ( data [ "stripeCheckoutSessionId" ] ) )
      }

      await draftRef.delete ( )
      return rep.status ( 200 ).send ( { message: "Checkout draft removed." } )
    } catch ( error ) {
      console.error ( "Error deleting checkout draft:", error )
      return rep.status ( 500 ).send ( { error: "Failed to delete checkout draft." } )
    }
  } )

  /**
   * PATCH /api/admin/events/registrations/:id/attendance
   * Toggle check-in / attended flag for a registration.
   */
  app.patch ( "/registrations/:id/attendance", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    try {
      const { id } = req.params as { id: string }
      const { attended } = ( req.body || { } ) as { attended?: boolean }
      if ( !id || typeof attended !== "boolean" ) {
        return rep.status ( 400 ).send ( { error: "Missing id or attended boolean." } )
      }

      const docRef = getFirestore ( ).collection ( "event_registrations" ).doc ( id )
      const doc = await docRef.get ( )
      if ( !doc.exists ) {
        return rep.status ( 404 ).send ( { error: "Registration not found" } )
      }
      if ( doc.data ( )?. [ "kind" ] === "draft" || doc.data ( )?. [ "status" ] === "awaiting_payment" ) {
        return rep.status ( 400 ).send ( { error: "Cannot mark a checkout draft as attended." } )
      }

      await docRef.update ( {
        attended,
        attendedAt: attended ? FieldValue.serverTimestamp ( ) : null
      } )

      return rep.send ( { message: "Attendance updated.", attended } )
    } catch ( error ) {
      console.error ( "Error updating attendance:", error )
      return rep.status ( 500 ).send ( { error: "Failed to update attendance." } )
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

      if ( !Number.isFinite ( amountPence ) || amountPence < 50 || amountPence > 500_000 ) {
        return rep.status ( 400 ).send ( { error: "Donation amount must be between £0.50 and £5,000." } )
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
            url: `${process.env["PUBLIC_DOMAIN"] || PUBLIC_DOMAIN}/events?registration=success`
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

      const eventId = String ( data [ "eventId" ] || "" )
      const email = String (
        data [ "email" ] || data [ "formData" ]?. [ "email" ] || data [ "formData" ]?. [ "Email" ] || ""
      ).toLowerCase ( ).trim ( )

      if ( eventId && email ) {
        await db.collection ( "event_checkout_drafts" ).doc ( checkoutDraftIdFor ( eventId, email ) ).delete ( ).catch ( ( ) => null )
      }
      // Paid registrations share the same doc id as their checkout draft
      await db.collection ( "event_checkout_drafts" ).doc ( id ).delete ( ).catch ( ( ) => null )

      clearEventsCache ( )

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
      console.log ( "Invalid events data format:", req.body )
      return rep.status ( 400 ).send ( "Invalid Events Data Format" )
    }

    if ( !events.length ) {
      console.log ( "Empty events data received:", req.body )
      return rep.status ( 400 ).send ( "Events data cannot be empty." )
    }

    if ( events.some ( ( event: { title: string } ) => !event.title ) ) {
      console.log ( "Event entry missing title:", events )
      return rep.status ( 400 ).send ( "All event entries must have a valid title." )
    }

    const admin = req.adminUser
    if ( !admin ) {
      return rep.status ( 401 ).send ( "Unauthorized." )
    }

    const stripe = StripeService.getStripeInstance ( )
    const db = getFirestore ( )
    const registrationCounts = await countRegistrationsByEventId ( db )
    const eventsCollection = db.collection ( "events" )
    const currentSnap = await eventsCollection.get ( )
    const existingById = new Map (
      currentSnap.docs
        .filter ( d => d.id !== "default" )
        .map ( d => [ d.id, d.data ( ) as Event ] )
    )

    const sanitizedEvents: Event [ ] = [ ]
    try {
      for ( const event of events ) {
        const model: Event = {
          id: event.id || `event-${Date.now ( )}-${Math.floor ( Math.random ( ) * 1000 )}`,
          title: String ( event.title || "" ).substring ( 0, 100 ),
          description: String ( event.description || "" ).substring ( 0, 500 ),
          location: String ( event.location || "" ).substring ( 0, 200 ),
          actionType: event.actionType === "form" || ( event.actionType as string ) === "contact" ? "form" : "webpage"
        }

        if ( event.startDate ) model.startDate = event.startDate
        if ( event.endDate ) model.endDate = event.endDate

        if ( event.longDescription ) {
          model.longDescription = String ( event.longDescription ).trim ( ).substring ( 0, 5000 )
        }

        if ( event.imageUrl ) model.imageUrl = String ( event.imageUrl ).trim ( )
        if ( event.startTime ) model.startTime = event.startTime
        if ( event.endTime ) model.endTime = event.endTime
        if ( event.donationRequired ) model.donationRequired = event.donationRequired
        if ( event.donationDescription ) model.donationDescription = String ( event.donationDescription ).substring ( 0, 500 )
        if ( event.donationPrice != null ) model.donationPrice = Number ( event.donationPrice )
        if ( event.stripeProductId ) model.stripeProductId = event.stripeProductId
        if ( event.stripePriceId ) model.stripePriceId = event.stripePriceId
        if ( event.maxAttendees != null && Number ( event.maxAttendees ) > 0 ) {
          model.maxAttendees = Math.min ( 10_000, Math.floor ( Number ( event.maxAttendees ) ) )
        }
        if ( event.waitlistEnabled === true ) model.waitlistEnabled = true
        if ( event.comingSoon === true ) model.comingSoon = true

        const targetOrgId = String ( event.organizationId || getDefaultOrganizationId ( ) ).trim ( )
        if ( !userCanAccessOrganization ( admin.role, admin.organizationIds, targetOrgId ) ) {
          throw new Error ( `You do not have access to publish events for organization "${targetOrgId}".` )
        }
        model.organizationId = targetOrgId

        const takesDonation = !!model.donationRequired && model.donationRequired !== "none"
        if ( takesDonation && !event.comingSoon ) {
          const org = await resolveOrganizationById ( targetOrgId )
          const isPlatformOrg = targetOrgId === getDefaultOrganizationId ( )
          if ( !isPlatformOrg && !org?.stripeConnectChargesEnabled && !StripeService.devUsesPlatformTestAccount ( ) ) {
            throw new Error (
              `Event "${model.title}": this organisation needs its own Stripe payouts before paid events can go live. Finish Stripe setup for ${org?.name || targetOrgId}.`
            )
          }
        }

        const prior = existingById.get ( model.id )
        const regCount = registrationCounts [ model.id ] || 0
        if ( prior && regCount > 0 ) {
          const prevDonation = prior.donationRequired || "none"
          const nextDonation = model.donationRequired || "none"
          if ( prevDonation !== nextDonation ) {
            throw new Error (
              `Event "${model.title}": donation setting cannot change while ${regCount} registration${regCount === 1 ? "" : "s"} exist.`
            )
          }
        }

        if ( !event.comingSoon ) {
          if ( model.actionType === "form" ) {
            if ( !Array.isArray ( event.contactFormFields ) || event.contactFormFields.length === 0 ) {
              throw new Error ( "Registration form events must have at least one form field." )
            }
            model.contactFormFields = Array.isArray ( event.contactFormFields ) ? event.contactFormFields : [ ]
          }
          if ( model.actionType === "webpage" ) {
            if ( !event.webpageUrl ) {
              throw new Error ( "Webpage events must have a webpage URL." )
            }
            model.webpageUrl = String ( event.webpageUrl ).trim ( )
          }
        } else {
          if ( Array.isArray ( event.contactFormFields ) && event.contactFormFields.length > 0 ) {
            model.contactFormFields = event.contactFormFields
          }
          if ( event.webpageUrl ) {
            model.webpageUrl = String ( event.webpageUrl ).trim ( )
          }
        }

        // Stripe product + price create / update
        if ( !event.comingSoon && model.donationRequired && model.donationRequired !== "none" ) {
          if ( !stripe ) {
            throw new Error ( "Stripe is not configured. Cannot create a donation-required event. Please add STRIPE_SECRET_KEY." )
          }
          if ( !model.donationPrice || model.donationPrice < 50 ) {
            throw new Error ( `Event "${model.title}" needs a donation price of at least £0.50.` )
          }

          const stripeImages = getAbsoluteImageUrl ( model.imageUrl )
            ? [ getAbsoluteImageUrl ( model.imageUrl ) as string ]
            : undefined

          if ( !model.stripeProductId ) {
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
          } else {
            await stripe.products.update ( model.stripeProductId, {
              name: model.title,
              description: model.donationDescription || model.description,
              ...( stripeImages ? { images: stripeImages } : { } )
            } ).catch ( ( ) => null )

            const priceChanged = !prior
              || prior.donationPrice !== model.donationPrice
              || !model.stripePriceId

            if ( priceChanged ) {
              const price = await stripe.prices.create ( {
                product: model.stripeProductId,
                unit_amount: model.donationPrice,
                currency: "gbp",
              } )
              if ( model.stripePriceId ) {
                await stripe.prices.update ( model.stripePriceId, { active: false } ).catch ( ( ) => null )
              }
              model.stripePriceId = price.id
            }
          }
        }

        sanitizedEvents.push ( model )
      }
    } catch ( error ) {
      console.error ( "Error processing events data:", error )
      return rep.status ( 400 ).send ( error instanceof Error ? error.message : "Error processing events data." )
    }

    try {
      const currentIds = [ ...existingById.keys ( ) ]
      const incomingIds = sanitizedEvents.map ( e => e.id )
      const idsToDelete = currentIds.filter ( id => !incomingIds.includes ( id ) )

      // Removals must go through DELETE /api/admin/events (refunds, voids, Checkout expiry).
      // Never silently drop event docs from a bulk save — that skips the money path.
      if ( idsToDelete.length > 0 ) {
        console.error ( `Attempted to remove events via save. IDs: ${idsToDelete.join ( ", " )}` )
        return rep.status ( 400 ).send ( {
          error: `Cannot remove events via save. Delete them individually first: ${idsToDelete.join ( ", " )}`
        } )
      }

      const ops: ( ( batch: WriteBatch ) => void ) [ ] = [ ]

      const defaultDoc = currentSnap.docs.find ( d => d.id === "default" )
      if ( defaultDoc ) {
        ops.push ( batch => batch.delete ( eventsCollection.doc ( "default" ) ) )
      }
      for ( const event of sanitizedEvents ) {
        ops.push ( batch => batch.set ( eventsCollection.doc ( event.id ), event ) )
      }

      await runBatchedWrites ( ops )

      eventsCache = { events: sanitizedEvents }
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

      const registrationsRef = db.collection ( "event_registrations" )
      const regsSnapshot = await registrationsRef.where ( "eventId", "==", id ).get ( )
      const draftsSnapshot = await db.collection ( "event_checkout_drafts" )
        .where ( "eventId", "==", id ).get ( )

      // Refund / void money first — abort delete if any refund fails
      for ( const regDoc of regsSnapshot.docs ) {
        const data = regDoc.data ( ) || { }
        const paymentIntentId = data [ "paymentIntent" ] ? String ( data [ "paymentIntent" ] ) : ""
        const stripeInvoiceId = data [ "stripeInvoiceId" ] ? String ( data [ "stripeInvoiceId" ] ) : ""

        if ( paymentIntentId ) {
          try {
            const result = await StripeService.refundPaymentIntent ( paymentIntentId )
            if ( !result && process.env [ "STRIPE_SECRET_KEY" ] ) {
              return rep.status ( 500 ).send ( {
                error: `Stripe refund failed for registration ${regDoc.id}. Event was not deleted.`
              } )
            }
          } catch ( err ) {
            console.error ( "Stripe refund error during event delete:", err )
            return rep.status ( 500 ).send ( {
              error: err instanceof Error
                ? err.message
                : `Stripe refund failed for registration ${regDoc.id}. Event was not deleted.`
            } )
          }
        } else if ( stripeInvoiceId ) {
          await StripeService.voidInvoiceIfOpen ( stripeInvoiceId )
        }
      }

      for ( const draftDoc of draftsSnapshot.docs ) {
        const data = draftDoc.data ( ) || { }
        if ( data [ "stripeInvoiceId" ] ) {
          await StripeService.voidInvoiceIfOpen ( String ( data [ "stripeInvoiceId" ] ) )
        }
        if ( data [ "stripeCheckoutSessionId" ] ) {
          await StripeService.expireCheckoutSession ( String ( data [ "stripeCheckoutSessionId" ] ) )
        }
      }

      const deleteOps: ( ( batch: WriteBatch ) => void ) [ ] = [
        batch => batch.delete ( docRef ),
        ...regsSnapshot.docs.map ( d => ( batch: WriteBatch ) => batch.delete ( d.ref ) ),
        ...draftsSnapshot.docs.map ( d => ( batch: WriteBatch ) => batch.delete ( d.ref ) )
      ]
      await runBatchedWrites ( deleteOps )

      if ( eventData.stripeProductId ) {
        const stripe = StripeService.getStripeInstance ( )
        if ( stripe ) {
          await stripe.products.update ( eventData.stripeProductId, { active: false } ).catch ( ( ) => null )
        }
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