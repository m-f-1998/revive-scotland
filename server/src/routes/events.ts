import { createHash } from "crypto"
import { FastifyPluginAsync } from "fastify"
import rateLimit from "@fastify/rate-limit"
import { getFirestore } from "./admin.js"
import Stripe from "stripe"
import { DocumentReference, FieldValue } from "firebase-admin/firestore"
import { RecaptchaService } from "../services/recaptcha.service.js"
import { StripeService } from "../services/stripe.service.js"
import { StaffNotifyService } from "../services/staff-notify.service.js"
import { isDevMode } from "./static.js"
import { newCancelToken, tokensMatch } from "../utils/cancel-token.js"

/** Stable draft id so concurrent paid registers for the same email reuse one draft. */
const checkoutDraftIdFor = ( eventId: string, email: string ): string => {
  return createHash ( "sha256" ).update ( `event:${eventId}:email:${email}` ).digest ( "hex" ).slice ( 0, 40 )
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string
  }
}

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
  /** Confirmed seats (status completed). Omit / 0 = unlimited. */
  maxAttendees?: number
  waitlistEnabled?: boolean
}

export type PublicEvent = Event & {
  registeredCount?: number
  spotsRemaining?: number | null
  isFull?: boolean
  waitlistOpen?: boolean
}

interface CheckoutDraft {
  eventId: string
  eventTitle: string
  formData: Record<string, unknown>
  email: string
  name: string
  amountPence?: number
  existingRegistrationId?: string
  stripeInvoiceId?: string
  donateLaterUrl?: string | null
  checkoutUrl?: string | null
  stripeCheckoutSessionId?: string | null
  /** Set when payment is confirmed — kept so status polls remain accurate after merge */
  finalized?: boolean
  registrationId?: string
  /** SHA-256 hex of the cancel token returned to the client */
  cancelTokenHash?: string
  createdAt: unknown
}

let eventsCache: PublicEvent [ ] | null = null
let cacheTime = 0
const TTL = 60000

export const clearEventsCache = ( ): void => {
  eventsCache = null
  cacheTime = 0
}

const countConfirmedSeats = async ( eventId: string ): Promise<number> => {
  const snap = await getFirestore ( ).collection ( "event_registrations" )
    .where ( "eventId", "==", eventId )
    .get ( )
  return snap.docs.filter ( d => d.data ( )?. [ "status" ] === "completed" ).length
}

const enrichWithCapacity = async ( events: Event [ ] ): Promise<PublicEvent [ ]> => {
  return Promise.all ( events.map ( async e => {
    const max = e.maxAttendees && e.maxAttendees > 0 ? e.maxAttendees : undefined
    if ( !max ) {
      return {
        ...e,
        registeredCount: undefined,
        spotsRemaining: null,
        isFull: false,
        waitlistOpen: false
      }
    }
    const registeredCount = await countConfirmedSeats ( e.id )
    const spotsRemaining = Math.max ( 0, max - registeredCount )
    const isFull = spotsRemaining <= 0
    return {
      ...e,
      maxAttendees: max,
      registeredCount,
      spotsRemaining,
      isFull,
      waitlistOpen: isFull && !!e.waitlistEnabled
    }
  } ) )
}

const resolveCapacityGate = async ( event: Event ): Promise<{
  allow: boolean
  asWaitlist: boolean
  message?: string
  registeredCount: number
}> => {
  const max = event.maxAttendees && event.maxAttendees > 0 ? event.maxAttendees : undefined
  if ( !max ) {
    return { allow: true, asWaitlist: false, registeredCount: 0 }
  }
  const registeredCount = await countConfirmedSeats ( event.id )
  if ( registeredCount < max ) {
    return { allow: true, asWaitlist: false, registeredCount }
  }
  if ( event.waitlistEnabled ) {
    return { allow: true, asWaitlist: true, registeredCount }
  }
  return {
    allow: false,
    asWaitlist: false,
    registeredCount,
    message: "This event is fully booked."
  }
}

export const normalizeActionType = ( value: unknown ): "webpage" | "form" => {
  return value === "form" || value === "contact" ? "form" : "webpage"
}

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

const findExistingRegistrationByEmail = async ( eventId: string, email: string ) => {
  if ( !email ) return undefined
  const db = getFirestore ( )

  // Prefer denormalized email field (indexed query)
  const byEmail = await db.collection ( "event_registrations" )
    .where ( "eventId", "==", eventId )
    .where ( "email", "==", email )
    .limit ( 1 )
    .get ( )
  if ( !byEmail.empty ) return byEmail.docs [ 0 ]

  // Fallback for legacy rows without denormalized email
  const snapshot = await db.collection ( "event_registrations" )
    .where ( "eventId", "==", eventId )
    .get ( )

  return snapshot.docs.find ( doc => {
    const regData = doc.data ( )
    const regEmail = String ( regData [ "formData" ]?. [ "email" ] || regData [ "formData" ]?. [ "Email" ] || "" )
      .toLowerCase ( )
      .trim ( )
    return regEmail === email
  } )
}

const MIN_DONATION_PENCE = 50
const MAX_DONATION_PENCE = 500_000

const parseDonationPence = ( pounds: unknown ): number | undefined => {
  if ( pounds == null || pounds === "" ) return undefined
  const pence = Math.round ( Number ( pounds ) * 100 )
  if ( !Number.isFinite ( pence ) ) return NaN as unknown as number
  return pence
}

const loadEvent = async ( eventId: string ): Promise<Event | undefined> => {
  const db = getFirestore ( )
  const eventDoc = await db.collection ( "events" ).doc ( eventId ).get ( )
  if ( eventDoc.exists ) {
    return eventDoc.data ( ) as Event
  }
  const defaultDoc = await db.collection ( "events" ).doc ( "default" ).get ( )
  return ( defaultDoc.data ( )?. [ "events" ] || [ ] ).find ( ( e: { id: string } ) => e.id === eventId )
}

/**
 * After Checkout is cancelled or expires, email a Stripe Invoice pay link.
 * Draft stays until the invoice is paid (then becomes a registration).
 */
const markDraftFinalized = async (
  draftRef: DocumentReference,
  registrationId: string
): Promise<void> => {
  await draftRef.set ( {
    finalized: true,
    registrationId,
    checkoutUrl: null,
    cancelTokenHash: FieldValue.delete ( ),
    finalizedAt: FieldValue.serverTimestamp ( )
  }, { merge: true } )
}

const sendPaymentPromptForDraft = async ( draftId: string ): Promise<{ emailed: boolean; hostedInvoiceUrl?: string | null }> => {
  const db = getFirestore ( )
  const draftRef = db.collection ( "event_checkout_drafts" ).doc ( draftId )
  const draftSnap = await draftRef.get ( )
  if ( !draftSnap.exists ) {
    return { emailed: false }
  }

  const draft = draftSnap.data ( ) as CheckoutDraft
  if ( draft.finalized ) {
    return { emailed: false }
  }
  if ( draft.stripeInvoiceId ) {
    return { emailed: true, hostedInvoiceUrl: draft.donateLaterUrl }
  }

  const event = await loadEvent ( draft.eventId )
  const customFromForm = draft.formData?. [ "customDonationAmount" ] != null
    ? Math.round ( Number ( draft.formData [ "customDonationAmount" ] ) * 100 )
    : undefined
  const amountPence = draft.amountPence || customFromForm || event?.donationPrice

  if ( !draft.email || !amountPence || amountPence < 50 ) {
    console.warn ( `Cannot email payment prompt for draft ${draftId}: missing email or amount.` )
    return { emailed: false }
  }

  const invoice = await StripeService.createAndSendDonationInvoice ( {
    email: draft.email,
    name: draft.name,
    amountPence,
    eventId: draft.eventId,
    eventTitle: draft.eventTitle || event?.title || "Event",
    registrationId: draftId,
    description: event?.donationDescription || `Complete your registration for ${draft.eventTitle || event?.title || "the event"}`,
    footer: `You started registering for ${draft.eventTitle || "this event"} but didn't finish payment. Use this Stripe invoice link to complete it. Your place is only confirmed after payment.`,
    daysUntilDue: 3
  } )

  if ( !invoice ) {
    return { emailed: false }
  }

  await draftRef.update ( {
    stripeInvoiceId: invoice.invoiceId,
    donateLaterUrl: invoice.hostedInvoiceUrl,
    paymentPromptSentAt: FieldValue.serverTimestamp ( )
  } )

  return { emailed: true, hostedInvoiceUrl: invoice.hostedInvoiceUrl }
}

const applyPaymentIntentSafely = async (
  regRef: DocumentReference,
  existingPaymentIntent: unknown,
  paymentIntent: string | null,
  extra: Record<string, unknown>
): Promise<void> => {
  const prior = existingPaymentIntent ? String ( existingPaymentIntent ) : ""
  if ( prior && paymentIntent && prior !== paymentIntent ) {
    console.warn (
      `Duplicate payment for ${regRef.id}: keeping ${prior}, refunding new ${paymentIntent}`
    )
    try {
      await StripeService.refundPaymentIntent ( paymentIntent )
    } catch ( err ) {
      console.error ( `Failed to refund duplicate payment ${paymentIntent}:`, err )
    }
    await regRef.update ( {
      status: "completed",
      ...extra
    } )
    return
  }

  await regRef.update ( {
    status: "completed",
    ...( paymentIntent ? { paymentIntent } : { } ),
    ...extra
  } )
}

const finalizePaidRegistration = async (
  draftId: string,
  paymentRef: string | Stripe.PaymentIntent | null | undefined
): Promise<void> => {
  const db = getFirestore ( )
  const draftRef = db.collection ( "event_checkout_drafts" ).doc ( draftId )
  const draftSnap = await draftRef.get ( )
  const paymentIntent = typeof paymentRef === "string" ? paymentRef : paymentRef?.id || null

  if ( draftSnap.exists ) {
    const draft = draftSnap.data ( ) as CheckoutDraft

    if ( draft.finalized ) {
      return
    }

    if ( draft.existingRegistrationId ) {
      const regRef = db.collection ( "event_registrations" ).doc ( draft.existingRegistrationId )
      const regSnap = await regRef.get ( )
      await applyPaymentIntentSafely (
        regRef,
        regSnap.data ( )?. [ "paymentIntent" ],
        paymentIntent,
        {
          donatedAt: FieldValue.serverTimestamp ( ),
          formData: draft.formData
        }
      )
      await markDraftFinalized ( draftRef, draft.existingRegistrationId )
      void StaffNotifyService.notify ( {
        type: "payment",
        eventId: draft.eventId,
        eventTitle: draft.eventTitle,
        email: draft.email,
        name: draft.name,
        amountPence: draft.amountPence ?? null
      } )
      return
    }

    const existing = await findExistingRegistrationByEmail ( draft.eventId, draft.email )
    if ( existing ) {
      await applyPaymentIntentSafely (
        existing.ref,
        existing.data ( )?. [ "paymentIntent" ],
        paymentIntent,
        {
          donatedAt: FieldValue.serverTimestamp ( ),
          formData: draft.formData
        }
      )
      await markDraftFinalized ( draftRef, existing.id )
    } else {
      await db.collection ( "event_registrations" ).doc ( draftId ).set ( {
        eventId: draft.eventId,
        eventTitle: draft.eventTitle,
        formData: draft.formData,
        email: draft.email || null,
        status: "completed",
        paymentIntent,
        createdAt: FieldValue.serverTimestamp ( ),
        donatedAt: FieldValue.serverTimestamp ( )
      }, { merge: true } )
      await markDraftFinalized ( draftRef, draftId )
    }
    clearEventsCache ( )
    void StaffNotifyService.notify ( {
      type: "payment",
      eventId: draft.eventId,
      eventTitle: draft.eventTitle,
      email: draft.email,
      name: draft.name,
      amountPence: draft.amountPence ?? null
    } )
    return
  }

  // Legacy pending_payment docs (pre-deferral) — mark complete if present
  const legacyRef = db.collection ( "event_registrations" ).doc ( draftId )
  const legacySnap = await legacyRef.get ( )
  if ( legacySnap.exists ) {
    await applyPaymentIntentSafely (
      legacyRef,
      legacySnap.data ( )?. [ "paymentIntent" ],
      paymentIntent,
      { donatedAt: FieldValue.serverTimestamp ( ) }
    )
  } else {
    console.warn ( `Checkout draft / registration ${draftId} was not found after payment.` )
  }
}

type CheckoutStartResult =
  | { ok: true; checkoutUrl: string; draftId: string; cancelToken: string }
  | { ok: false; reason: "already_paid" | "stripe_unavailable" }

/**
 * Creates or resumes a Checkout Session for (eventId, email).
 * Deterministic draft ids prevent concurrent double-charges for the same registrant.
 */
const startOrResumeCheckout = async ( opts: {
  eventId: string
  event: Event
  email: string
  name: string
  formData: Record<string, unknown>
  amountPence: number | undefined
  customAmountInPence?: number
  existingRegistrationId?: string
} ): Promise<CheckoutStartResult> => {
  const draftRef = getFirestore ( )
    .collection ( "event_checkout_drafts" )
    .doc ( checkoutDraftIdFor ( opts.eventId, opts.email ) )

  const existingSnap = await draftRef.get ( )
  if ( existingSnap.exists ) {
    const existing = existingSnap.data ( ) as CheckoutDraft
    if ( existing.finalized ) {
      return { ok: false, reason: "already_paid" }
    }
    if (
      existing.checkoutUrl
      && existing.amountPence === opts.amountPence
      && ( existing.existingRegistrationId || null ) === ( opts.existingRegistrationId || null )
    ) {
      const { token: cancelToken, hash: cancelTokenHash } = newCancelToken ( )
      await draftRef.update ( { cancelTokenHash } )
      return {
        ok: true,
        checkoutUrl: existing.checkoutUrl,
        draftId: draftRef.id,
        cancelToken
      }
    }
    if ( existing.stripeCheckoutSessionId ) {
      await StripeService.expireCheckoutSession ( existing.stripeCheckoutSessionId )
    }
  }

  const { token: cancelToken, hash: cancelTokenHash } = newCancelToken ( )
  await draftRef.set ( {
    eventId: opts.eventId,
    eventTitle: opts.event.title,
    formData: opts.formData,
    email: opts.email,
    name: opts.name,
    amountPence: opts.amountPence,
    ...( opts.existingRegistrationId ? { existingRegistrationId: opts.existingRegistrationId } : { } ),
    cancelTokenHash,
    finalized: false,
    checkoutUrl: null,
    stripeCheckoutSessionId: null,
    createdAt: FieldValue.serverTimestamp ( )
  } )

  const session = await StripeService.createEventCheckoutSession (
    opts.eventId,
    opts.event.stripePriceId || "",
    draftRef.id,
    opts.customAmountInPence,
    opts.event.stripeProductId,
    opts.email
  )

  if ( !session ) {
    await draftRef.delete ( )
    return { ok: false, reason: "stripe_unavailable" }
  }

  await draftRef.update ( {
    checkoutUrl: session.url,
    stripeCheckoutSessionId: session.sessionId
  } )

  if ( isDevMode ( ) && !process.env [ "STRIPE_SECRET_KEY" ] ) {
    await finalizePaidRegistration ( draftRef.id, "dev_simulated" )
  }

  return {
    ok: true,
    checkoutUrl: session.url,
    draftId: draftRef.id,
    cancelToken
  }
}

export const router: FastifyPluginAsync = async app => {
  await app.register ( rateLimit, {
    max: isDevMode ( ) ? 200 : 30,
    timeWindow: "1 minute"
  } )

  app.addContentTypeParser ( "application/json", { parseAs: "string" }, ( req, body, done ) => {
    try {
      const parsed = JSON.parse ( body as string )
      req.rawBody = body as string
      done ( null, parsed )
    } catch ( err ) {
      const errorObj = err as Error & { statusCode?: number }
      errorObj.statusCode = 400
      done ( errorObj, undefined )
    }
  } )

  app.get ( "/", async ( _req, rep ) => {
    try {
      if ( eventsCache && Date.now ( ) - cacheTime < TTL ) {
        return rep.send ( { events: eventsCache } )
      }

      const db = getFirestore ( )
      const snapshot = await db.collection ( "events" ).get ( )

      let events: Event[] = [ ]

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
        actionType: normalizeActionType ( e.actionType ),
        imageUrl: resolveImageUrl ( e.imageUrl )
      } ) )

      eventsCache = await enrichWithCapacity ( activeEvents )
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( { events: eventsCache } )
    } catch ( error ) {
      console.error ( "Error fetching events data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch events configuration." )
    }
  } )

  /** Past events archive (ended; excludes upcoming). */
  app.get ( "/archive", async ( _req, rep ) => {
    try {
      const db = getFirestore ( )
      const snapshot = await db.collection ( "events" ).get ( )
      let events: Event [ ] = [ ]
      const legacyDoc = snapshot.docs.find ( doc => doc.id === "default" )
      if ( legacyDoc?.exists ) {
        const legacyData = legacyDoc.data ( ) as { events?: Event [ ] }
        events = Array.isArray ( legacyData.events ) ? legacyData.events : [ ]
      } else {
        events = snapshot.docs.map ( doc => doc.data ( ) as Event )
      }

      const now = new Date ( )
      const past = events
        .filter ( e => {
          const end = new Date ( e.endDate )
          return !isNaN ( end.getTime ( ) ) && end < now
        } )
        .sort ( ( a, b ) => new Date ( b.endDate ).getTime ( ) - new Date ( a.endDate ).getTime ( ) )
        .slice ( 0, 60 )
        .map ( e => ( {
          ...e,
          actionType: normalizeActionType ( e.actionType ),
          imageUrl: resolveImageUrl ( e.imageUrl )
        } ) )

      return rep.send ( { events: past } )
    } catch ( error ) {
      console.error ( "Error fetching archived events:", error )
      return rep.status ( 500 ).send ( "Failed to fetch archived events." )
    }
  } )

  app.get ( "/:id", async ( req, rep ) => {
    try {
      const { id } = req.params as { id: string }
      if ( !id ) {
        return rep.status ( 400 ).send ( { error: "Missing event ID" } )
      }

      const event = await loadEvent ( id )
      if ( !event ) {
        return rep.status ( 404 ).send ( { error: "Event not found" } )
      }

      event.actionType = normalizeActionType ( event.actionType )
      event.imageUrl = resolveImageUrl ( event.imageUrl )

      return rep.status ( 200 ).send ( event )
    } catch ( error ) {
      console.error ( "Error fetching specific event data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch event." )
    }
  } )

  /** Poll whether a checkout draft has been finalized into a paid registration. */
  app.get ( "/checkout-draft/:draftId/status", async ( req, rep ) => {
    const { draftId } = req.params as { draftId: string }
    if ( !draftId ) {
      return rep.status ( 400 ).send ( { message: "Missing draft id." } )
    }

    const db = getFirestore ( )
    const draftSnap = await db.collection ( "event_checkout_drafts" ).doc ( draftId ).get ( )
    if ( draftSnap.exists ) {
      if ( draftSnap.data ( )?. [ "finalized" ] === true ) {
        return rep.send ( { status: "paid" } )
      }
      return rep.send ( { status: "pending" } )
    }

    const regSnap = await db.collection ( "event_registrations" ).doc ( draftId ).get ( )
    if ( regSnap.exists && regSnap.data ( )?. [ "status" ] === "completed" ) {
      return rep.send ( { status: "paid" } )
    }

    return rep.send ( { status: "not_found" } )
  } )

  /** Cancelled Checkout: email a Stripe pay-link invoice; keep draft until paid. */
  app.post ( "/checkout-draft/:draftId/discard", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute"
      }
    }
  }, async ( req, rep ) => {
    const { draftId } = req.params as { draftId: string }
    const { cancelToken } = ( req.body || { } ) as { cancelToken?: string }

    if ( !draftId || !cancelToken ) {
      return rep.status ( 400 ).send ( { message: "Missing draft id or cancel token." } )
    }

    try {
      const draftRef = getFirestore ( ).collection ( "event_checkout_drafts" ).doc ( draftId )
      const draftSnap = await draftRef.get ( )
      if ( !draftSnap.exists ) {
        return rep.status ( 404 ).send ( { message: "Draft not found." } )
      }

      const draft = draftSnap.data ( ) as CheckoutDraft
      if ( draft.finalized ) {
        return rep.send ( { message: "Payment already completed.", emailed: false } )
      }
      if ( !draft.cancelTokenHash || !tokensMatch ( cancelToken, draft.cancelTokenHash ) ) {
        return rep.status ( 403 ).send ( { message: "Invalid cancel token." } )
      }

      const result = await sendPaymentPromptForDraft ( draftId )
      return rep.send ( {
        message: result.emailed
          ? "Payment prompt emailed via Stripe."
          : "Checkout cancelled. No payment email could be sent.",
        emailed: result.emailed,
        hostedInvoiceUrl: result.hostedInvoiceUrl
      } )
    } catch ( error ) {
      console.error ( "Error sending payment prompt for checkout draft:", error )
      return rep.status ( 500 ).send ( { message: "Failed to send payment prompt." } )
    }
  } )

  app.post ( "/:eventId/register", async ( req, rep ) => {
    const { eventId } = req.params as { eventId: string }
    const formData = req.body as Record<string, unknown>
    const recaptchaToken = formData?. [ "recaptchaToken" ] as string | undefined
    const optInDonation = formData?. [ "optInDonation" ] === true

    if ( !recaptchaToken ) {
      return rep.status ( 400 ).send ( { message: "reCAPTCHA token missing." } )
    }

    try {
      await RecaptchaService.verifyToken ( recaptchaToken )
    } catch ( err ) {
      console.error ( "reCAPTCHA verification error:", err )
      return rep.status ( 500 ).send ( { message: "reCAPTCHA verification error." } )
    }

    const customDonationPence = parseDonationPence ( formData?. [ "customDonationAmount" ] )
    if ( customDonationPence !== undefined ) {
      if ( !Number.isFinite ( customDonationPence )
        || customDonationPence < MIN_DONATION_PENCE
        || customDonationPence > MAX_DONATION_PENCE ) {
        return rep.status ( 400 ).send ( { message: "Donation amount must be between £0.50 and £5,000." } )
      }
    }
    const customDonationAmount = customDonationPence != null ? customDonationPence / 100 : undefined

    const email = String ( formData [ "email" ] || formData [ "Email" ] || "" ).toLowerCase ( ).trim ( )
    const name = String (
      formData [ "name" ] || formData [ "Name" ] || formData [ "firstName" ] || formData [ "First Name" ] || ""
    ).trim ( )

    const event = await loadEvent ( eventId )
    if ( !event ) {
      return rep.status ( 404 ).send ( { message: "Event not found." } )
    }

    const capacity = await resolveCapacityGate ( event )

    if ( email ) {
      const existingReg = await findExistingRegistrationByEmail ( eventId, email )
      if ( existingReg ) {
        const regData = existingReg.data ( )
        const alreadyDonated = !!regData [ "paymentIntent" ]

        // Optional: already registered free, now choosing to donate
        if ( regData [ "status" ] === "completed" && !alreadyDonated && optInDonation
          && event.donationRequired === "optional" && event.stripePriceId ) {
          const customAmountInPence = customDonationPence ?? event.donationPrice
          const checkout = await startOrResumeCheckout ( {
            eventId,
            event,
            email,
            name,
            formData: {
              ...( regData [ "formData" ] || { } ),
              optInDonation: true,
              ...( customDonationAmount != null ? { customDonationAmount } : { } )
            },
            amountPence: customAmountInPence,
            customAmountInPence,
            existingRegistrationId: existingReg.id
          } )
          if ( checkout.ok ) {
            return rep.send ( {
              message: "Redirecting you to complete your optional donation.",
              checkoutUrl: checkout.checkoutUrl,
              draftId: checkout.draftId,
              cancelToken: checkout.cancelToken
            } )
          }
          if ( checkout.reason === "already_paid" ) {
            return rep.status ( 400 ).send ( { message: "You are already successfully registered for this event." } )
          }
        }

        if ( regData [ "status" ] === "waitlist" ) {
          return rep.status ( 400 ).send ( { message: "You are already on the waitlist for this event." } )
        }

        if ( regData [ "status" ] === "completed" ) {
          return rep.status ( 400 ).send ( { message: "You are already successfully registered for this event." } )
        }
      }
    }

    delete formData [ "recaptchaToken" ]
    delete formData [ "optInDonation" ]
    delete formData [ "customDonationAmount" ]

    const isRequired = event.donationRequired === "required"
    const isOptionalAndOptedIn = event.donationRequired === "optional" && optInDonation
    const requiresPayment = isRequired || isOptionalAndOptedIn

    const cleanedFormData: Record<string, unknown> = {
      ...formData,
      ...( optInDonation ? { optInDonation: true } : { } ),
      ...( customDonationAmount != null ? { customDonationAmount } : { } )
    }

    // Payment required: hold details in a checkout draft only — no registration until Stripe pays
    if ( requiresPayment ) {
      if ( !email ) {
        return rep.status ( 400 ).send ( { message: "Email is required to complete payment." } )
      }

      // Paid places need an open seat (waitlist is free-only)
      if ( !capacity.allow || capacity.asWaitlist ) {
        return rep.status ( 400 ).send ( {
          message: capacity.asWaitlist
            ? ( event.donationRequired === "required"
              ? "This event is fully booked."
              : "This event is full. Register without a donation to join the waitlist, or contact us." )
            : ( capacity.message || "This event is fully booked." )
        } )
      }

      const amountPence = ( isOptionalAndOptedIn && customDonationPence != null )
        ? customDonationPence
        : event.donationPrice
      const customAmountInPence = ( isOptionalAndOptedIn && customDonationPence != null )
        ? customDonationPence
        : undefined

      try {
        const checkout = await startOrResumeCheckout ( {
          eventId,
          event,
          email,
          name,
          formData: cleanedFormData,
          amountPence,
          customAmountInPence
        } )

        if ( !checkout.ok ) {
          if ( checkout.reason === "already_paid" ) {
            return rep.status ( 400 ).send ( { message: "You are already successfully registered for this event." } )
          }
          return rep.status ( 500 ).send ( { message: "Unable to start payment. Please try again." } )
        }

        return rep.send ( {
          message: "Redirecting to payment. Registration is only saved after payment succeeds.",
          checkoutUrl: checkout.checkoutUrl,
          draftId: checkout.draftId,
          cancelToken: checkout.cancelToken
        } )
      } catch ( err ) {
        console.error ( "Stripe Session Creation Error:", err )
        return rep.status ( 500 ).send ( { message: "Stripe Session Creation Error" } )
      }
    }

    // Free registration (no donation / optional without opt-in) — never auto-email invoices
    if ( !capacity.allow ) {
      return rep.status ( 400 ).send ( { message: capacity.message || "This event is fully booked." } )
    }

    const status = capacity.asWaitlist ? "waitlist" : "completed"
    const registrationRef = getFirestore ( ).collection ( "event_registrations" ).doc ( )
    const registrationPayload: Record<string, unknown> = {
      eventId,
      eventTitle: event.title,
      formData: cleanedFormData,
      email: email || null,
      status,
      attended: false,
      createdAt: FieldValue.serverTimestamp ( )
    }

    await registrationRef.set ( registrationPayload )
    clearEventsCache ( )

    void StaffNotifyService.notify ( {
      type: "registration",
      eventId,
      eventTitle: event.title,
      email: email || null,
      name
    } )

    return rep.send ( {
      message: status === "waitlist" ? "Added to the waitlist." : "Registration recorded.",
      status
    } )
  } )

  app.post ( "/stripe/webhook", async ( req, rep ) => {
    const sig = req.headers [ "stripe-signature" ] as string

    if ( !sig ) {
      return rep.status ( 400 ).send ( "Missing Stripe signature" )
    }

    let event: Stripe.Event
    const body = req.rawBody || ""

    try {
      event = StripeService.constructWebhookEvent ( body, sig )
    } catch ( err ) {
      console.error ( "Webhook Error:", err )
      return rep.status ( 400 ).send ( `Webhook Error` )
    }

    if ( event.type === "checkout.session.completed" ) {
      const session = event.data.object as Stripe.Checkout.Session
      const draftId = session.client_reference_id || session.metadata?. [ "registrationId" ] || session.metadata?. [ "draftId" ]
      if ( draftId ) {
        await finalizePaidRegistration ( draftId, session.payment_intent )
      }
    }

    if ( event.type === "invoice.paid" || event.type === "invoice.payment_succeeded" ) {
      const invoice = event.data.object as Stripe.Invoice
      const registrationId = invoice.metadata?. [ "registrationId" ]
      if ( registrationId ) {
        const paymentRef = ( invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null } ).payment_intent
        const db = getFirestore ( )
        const docRef = db.collection ( "event_registrations" ).doc ( registrationId )
        const docSnap = await docRef.get ( )
        if ( docSnap.exists ) {
          await docRef.update ( {
            status: "completed",
            paymentIntent: typeof paymentRef === "string" ? paymentRef : paymentRef?.id || null,
            donatedAt: FieldValue.serverTimestamp ( )
          } )
        } else {
          await finalizePaidRegistration ( registrationId, paymentRef )
        }
      }
    }

    // Abandoned Checkout: email Stripe invoice pay link (draft kept until paid)
    if ( event.type === "checkout.session.expired" ) {
      const session = event.data.object as Stripe.Checkout.Session
      const draftId = session.client_reference_id || session.metadata?. [ "draftId" ]
      if ( draftId ) {
        try {
          await sendPaymentPromptForDraft ( draftId )
        } catch ( err ) {
          console.error ( "Failed to email payment prompt after checkout expiry:", err )
        }
      }
    }

    return rep.send ( { received: true } )
  } )
}
