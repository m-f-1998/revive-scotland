import { createHash } from "crypto"
import { FastifyPluginAsync } from "fastify"
import rateLimit from "@fastify/rate-limit"
import { getFirestore } from "./admin.js"
import Stripe from "stripe"
import { DocumentReference, FieldValue } from "firebase-admin/firestore"
import { RecaptchaService, recaptchaContextFromRequest } from "../services/recaptcha.service.js"
import { StripeService } from "../services/stripe.service.js"
import { StaffNotifyService } from "../services/staff-notify.service.js"
import { EmailService } from "../services/email.service.js"
import { isDevMode } from "./static.js"
import { newCancelToken, tokensMatch } from "../utils/cancel-token.js"

/** Stable draft id so concurrent paid registers for the same email reuse one draft. */
export const checkoutDraftIdFor = ( eventId: string, email: string ): string => {
  return createHash ( "sha256" ).update ( `event:${eventId}:email:${email}` ).digest ( "hex" ).slice ( 0, 40 )
}

const registrationIdForDraft = ( draft: CheckoutDraft, draftId: string ): string => {
  return draft.registrationId || draft.existingRegistrationId || draftId
}

const isActiveCompletedRegistration = async ( registrationId: string ): Promise<boolean> => {
  const snap = await getFirestore ( ).collection ( "event_registrations" ).doc ( registrationId ).get ( )
  return snap.exists && snap.data ( )?. [ "status" ] === "completed"
}

/** Remove finalized drafts whose registration was deleted in admin. */
const clearStaleFinalizedDraft = async (
  draftRef: DocumentReference,
  draft: CheckoutDraft,
  draftId: string
): Promise<boolean> => {
  if ( !draft.finalized ) return false
  const regId = registrationIdForDraft ( draft, draftId )
  if ( await isActiveCompletedRegistration ( regId ) ) {
    return false
  }
  await draftRef.delete ( )
  return true
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
  longDescription?: string
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
  /** Set when payment was refunded (e.g. event full at finalize) */
  refundedReason?: string
  /** SHA-256 hex of the cancel token returned to the client (kept after finalize for status polls) */
  cancelTokenHash?: string
  /** Optional opt-in: registration emails sent while checkout draft remains open for donation */
  registrationEmailsSentAt?: unknown
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
    .where ( "status", "==", "completed" )
    .count ( )
    .get ( )
  return snap.data ( ).count
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

export const filterUpcomingEvents = ( events: Event [ ] ): Event [ ] => {
  const now = new Date ( )

  return events.filter ( event => {
    const eventEndDate = new Date ( event.endDate )
    if ( !isNaN ( eventEndDate.getTime ( ) ) ) {
      return eventEndDate >= now
    }
    return true
  } ).sort ( ( a, b ) => new Date ( a.startDate ).getTime ( ) - new Date ( b.startDate ).getTime ( ) )
}

/** @deprecated Use filterUpcomingEvents */
export const filterActiveAndRecentEvents = filterUpcomingEvents

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

const formatEventDateForEmail = ( event: Event ): string => {
  const start = new Date ( event.startDate )
  const end = new Date ( event.endDate )
  const dateFmt = new Intl.DateTimeFormat ( "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" } )
  let text = dateFmt.format ( start )
  if ( event.startTime ) text += ` at ${event.startTime}`
  if ( !isNaN ( end.getTime ( ) ) && end.toDateString ( ) !== start.toDateString ( ) ) {
    text += ` – ${dateFmt.format ( end )}`
    if ( event.endTime ) text += ` at ${event.endTime}`
  } else if ( event.endTime ) {
    text += ` – ${event.endTime}`
  }
  return text
}

const sendRegistrationEmails = ( opts: {
  event: Event
  email: string
  name?: string
  status: "completed" | "waitlist"
  amountPence?: number | null
} ): void => {
  void StaffNotifyService.notify ( {
    type: "registration",
    eventId: opts.event.id,
    eventTitle: opts.event.title,
    email: opts.email,
    name: opts.name,
    amountPence: opts.amountPence ?? null,
    status: opts.status,
    eventDate: formatEventDateForEmail ( opts.event ),
    eventLocation: opts.event.location,
    donationRequired: opts.event.donationRequired
  } )
  void EmailService.sendRegistrantConfirmation ( {
    to: opts.email,
    name: opts.name,
    eventTitle: opts.event.title,
    eventDate: formatEventDateForEmail ( opts.event ),
    eventLocation: opts.event.location,
    status: opts.status
  } )
}

/** Remove a just-written seat if a concurrent register raced past the capacity check. */
const healOverbookIfNeeded = async (
  event: Event,
  regRef: DocumentReference
): Promise<boolean> => {
  if ( !event.maxAttendees || event.maxAttendees <= 0 ) return false
  const seats = await countConfirmedSeats ( event.id )
  if ( seats <= event.maxAttendees ) return false
  console.warn ( `Overbook heal: removing registration ${regRef.id} for event ${event.id}.` )
  await regRef.delete ( )
  clearEventsCache ( )
  return true
}

/** Optional donation: confirm the registrant immediately, keep the draft open for payment. */
const ensureOptionalRegistrationFromDraft = async (
  draftRef: DocumentReference,
  draft: CheckoutDraft,
  event: Event
): Promise<CheckoutDraft> => {
  if ( draft.existingRegistrationId ) return draft

  const existing = await findExistingRegistrationByEmail ( draft.eventId, draft.email )
  if ( existing ) {
    await draftRef.update ( { existingRegistrationId: existing.id } )
    return { ...draft, existingRegistrationId: existing.id }
  }

  const capacity = await resolveCapacityGate ( event )
  if ( !capacity.allow || capacity.asWaitlist ) return draft

  const regRef = getFirestore ( ).collection ( "event_registrations" ).doc ( )
  const regRefId = regRef.id

  const claimed = await getFirestore ( ).runTransaction ( async tx => {
    const snap = await tx.get ( draftRef )
    if ( !snap.exists ) return false
    const current = snap.data ( ) as CheckoutDraft
    if ( current.existingRegistrationId || current.registrationEmailsSentAt ) return false
    tx.update ( draftRef, {
      existingRegistrationId: regRefId,
      registrationEmailsSentAt: FieldValue.serverTimestamp ( )
    } )
    return true
  } )

  if ( !claimed ) {
    const refreshed = ( await draftRef.get ( ) ).data ( ) as CheckoutDraft | undefined
    return refreshed || draft
  }

  await regRef.set ( {
    eventId: draft.eventId,
    eventTitle: draft.eventTitle || event.title,
    formData: draft.formData,
    email: draft.email,
    status: "completed",
    attended: false,
    createdAt: FieldValue.serverTimestamp ( )
  } )
  clearEventsCache ( )

  if ( await healOverbookIfNeeded ( event, regRef ) ) {
    await draftRef.update ( {
      existingRegistrationId: FieldValue.delete ( ),
      registrationEmailsSentAt: FieldValue.delete ( )
    } ).catch ( ( ) => null )
    return draft
  }

  sendRegistrationEmails ( {
    event,
    email: draft.email,
    name: draft.name,
    status: "completed"
  } )

  return { ...draft, existingRegistrationId: regRefId }
}

/**
 * After Checkout is cancelled or expires, email a Stripe Invoice pay link.
 * Optional donations: registration is confirmed first; draft stays open until donation is paid.
 */
const refundAndCloseDraft = async (
  draftRef: DocumentReference,
  paymentIntent: string | null,
  reason: string
): Promise<void> => {
  if ( paymentIntent ) {
    try {
      await StripeService.refundPaymentIntent ( paymentIntent )
    } catch ( err ) {
      console.error ( `Failed to refund ${paymentIntent} (${reason}):`, err )
    }
  }
  await draftRef.set ( {
    finalized: true,
    refundedReason: reason,
    checkoutUrl: null,
    finalizedAt: FieldValue.serverTimestamp ( )
  }, { merge: true } )
}

/** Atomically claim a draft so concurrent webhooks cannot double-finalize. */
const claimDraftForFinalize = async (
  draftRef: DocumentReference,
  registrationId: string
): Promise<CheckoutDraft | null> => {
  return getFirestore ( ).runTransaction ( async tx => {
    const snap = await tx.get ( draftRef )
    if ( !snap.exists ) return null
    const draft = snap.data ( ) as CheckoutDraft
    if ( draft.finalized ) return null
    tx.update ( draftRef, {
      finalized: true,
      registrationId,
      checkoutUrl: null,
      finalizedAt: FieldValue.serverTimestamp ( )
    } )
    return draft
  } )
}

const copyStatusTokenToRegistration = async (
  registrationId: string,
  statusTokenHash?: string
): Promise<void> => {
  if ( !statusTokenHash ) return
  await getFirestore ( ).collection ( "event_registrations" ).doc ( registrationId ).set ( {
    statusTokenHash
  }, { merge: true } )
}

const registrantNameFromFormData = ( formData: Record<string, unknown> | undefined ): string | undefined => {
  if ( !formData ) return undefined
  const name = String (
    formData [ "name" ] || formData [ "Name" ] || formData [ "firstName" ] || formData [ "First Name" ] || ""
  ).trim ( )
  return name || undefined
}

const sendPaymentReceivedNotifications = async ( opts: {
  eventId: string
  eventTitle: string
  email?: string | null
  name?: string
  amountPence?: number | null
  eventDate?: string
  eventLocation?: string
  donationRequired?: "none" | "optional" | "required"
} ): Promise<void> => {
  const email = String ( opts.email || "" ).trim ( )
  if ( !email ) return

  void StaffNotifyService.notify ( {
    type: "payment_received",
    eventId: opts.eventId,
    eventTitle: opts.eventTitle,
    email,
    name: opts.name,
    amountPence: opts.amountPence ?? null,
    eventDate: opts.eventDate,
    eventLocation: opts.eventLocation,
    donationRequired: opts.donationRequired
  } )

  void EmailService.sendRegistrantPaymentReceived ( {
    to: email,
    name: opts.name,
    eventTitle: opts.eventTitle,
    eventDate: opts.eventDate,
    eventLocation: opts.eventLocation,
    amountPence: opts.amountPence ?? null
  } )
}

const sendPaymentReceivedNotificationsForRegistration = async ( opts: {
  regData: Record<string, unknown>
  amountPence?: number | null
} ): Promise<void> => {
  const email = String ( opts.regData [ "email" ] || "" ).trim ( )
  if ( !email ) return

  const eventId = String ( opts.regData [ "eventId" ] || "" )
  const event = eventId ? await loadEvent ( eventId ) : null
  const eventTitle = String ( opts.regData [ "eventTitle" ] || event?.title || "the event" )
  const formData = opts.regData [ "formData" ] as Record<string, unknown> | undefined

  await sendPaymentReceivedNotifications ( {
    eventId: eventId || "unknown",
    eventTitle,
    email,
    name: registrantNameFromFormData ( formData ),
    amountPence: opts.amountPence ?? null,
    eventDate: event ? formatEventDateForEmail ( event ) : undefined,
    eventLocation: event?.location,
    donationRequired: event?.donationRequired
  } )
}

const trySendPaidRegistrationEmails = async (
  draftRef: DocumentReference,
  opts: Parameters<typeof sendRegistrationEmails> [ 0 ]
): Promise<void> => {
  const shouldSend = await getFirestore ( ).runTransaction ( async tx => {
    const snap = await tx.get ( draftRef )
    if ( !snap.exists ) return false
    if ( snap.data ( )?. [ "emailsSentAt" ] ) return false
    tx.update ( draftRef, { emailsSentAt: FieldValue.serverTimestamp ( ) } )
    return true
  } )
  if ( shouldSend ) {
    sendRegistrationEmails ( opts )
  }
}

const trySendStaffRegistrationNotify = async (
  draftRef: DocumentReference,
  payload: Parameters<typeof StaffNotifyService.notify> [ 0 ]
): Promise<void> => {
  const shouldSend = await getFirestore ( ).runTransaction ( async tx => {
    const snap = await tx.get ( draftRef )
    if ( !snap.exists ) return false
    if ( snap.data ( )?. [ "emailsSentAt" ] ) return false
    tx.update ( draftRef, { emailsSentAt: FieldValue.serverTimestamp ( ) } )
    return true
  } )
  if ( shouldSend ) {
    void StaffNotifyService.notify ( payload )
  }
}

const trySendDonationFollowUpEmails = async (
  draftRef: DocumentReference,
  opts: {
    eventId: string
    eventTitle: string
    email?: string | null
    name?: string
    amountPence?: number | null
    eventDate?: string
    eventLocation?: string
    donationRequired?: "none" | "optional" | "required"
  }
): Promise<void> => {
  const shouldSend = await getFirestore ( ).runTransaction ( async tx => {
    const snap = await tx.get ( draftRef )
    if ( !snap.exists ) return false
    if ( snap.data ( )?. [ "emailsSentAt" ] ) return false
    tx.update ( draftRef, { emailsSentAt: FieldValue.serverTimestamp ( ) } )
    return true
  } )
  if ( shouldSend ) {
    await sendPaymentReceivedNotifications ( opts )
  }
}

const sendPaymentPromptForDraft = async (
  draftId: string,
  opts?: { cancelToken?: string }
): Promise<{ emailed: boolean; hostedInvoiceUrl?: string | null; cancelToken?: string }> => {
  const db = getFirestore ( )
  const draftRef = db.collection ( "event_checkout_drafts" ).doc ( draftId )
  const draftSnap = await draftRef.get ( )
  if ( !draftSnap.exists ) {
    return { emailed: false }
  }

  let draft = draftSnap.data ( ) as CheckoutDraft
  if ( draft.finalized ) {
    return { emailed: false }
  }

  const event = await loadEvent ( draft.eventId )
  const customFromForm = draft.formData?. [ "customDonationAmount" ] != null
    ? Math.round ( Number ( draft.formData [ "customDonationAmount" ] ) * 100 )
    : undefined
  const amountPence = draft.amountPence || customFromForm || event?.donationPrice

  if ( event?.donationRequired === "optional" && draft.email ) {
    draft = await ensureOptionalRegistrationFromDraft ( draftRef, draft, event )
  }

  const voidDraftInvoiceIfOpen = async ( ): Promise<void> => {
    if ( !draft.stripeInvoiceId ) return
    await StripeService.voidInvoiceIfOpen ( draft.stripeInvoiceId )
    await draftRef.update ( {
      stripeInvoiceId: FieldValue.delete ( ),
      donateLaterUrl: FieldValue.delete ( )
    } )
  }

  // After cancel: void any open invoice, expire Checkout, and issue a fresh session.
  if ( opts?.cancelToken && event?.stripePriceId && draft.email && amountPence && amountPence >= 50 ) {
    if ( !draft.cancelTokenHash || !tokensMatch ( opts.cancelToken, draft.cancelTokenHash ) ) {
      return { emailed: false }
    }

    await voidDraftInvoiceIfOpen ( )

    if ( draft.stripeCheckoutSessionId ) {
      await StripeService.expireCheckoutSession ( draft.stripeCheckoutSessionId )
    }

    const { token: rotatedCancelToken, hash: rotatedCancelTokenHash } = newCancelToken ( )
    const session = await StripeService.createEventCheckoutSession (
      draft.eventId,
      event.stripePriceId,
      draftId,
      customFromForm ?? amountPence,
      event.stripeProductId,
      draft.email
    )

    if ( session ) {
      await draftRef.update ( {
        cancelTokenHash: rotatedCancelTokenHash,
        checkoutUrl: session.url,
        stripeCheckoutSessionId: session.sessionId,
        stripeInvoiceId: FieldValue.delete ( ),
        donateLaterUrl: FieldValue.delete ( )
      } )
      return {
        emailed: true,
        hostedInvoiceUrl: session.url,
        cancelToken: rotatedCancelToken
      }
    }

    // Cancelled checkout — do not fall back to an old invoice or create a new one.
    return { emailed: false }
  }

  if ( draft.checkoutUrl ) {
    return { emailed: true, hostedInvoiceUrl: draft.checkoutUrl }
  }
  if ( draft.stripeInvoiceId ) {
    return { emailed: true, hostedInvoiceUrl: draft.donateLaterUrl }
  }

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
    description: event?.donationDescription || `Optional donation — ${draft.eventTitle || event?.title || "the event"}`,
    footer: draft.existingRegistrationId || event?.donationRequired === "optional"
      ? `You're registered for ${draft.eventTitle || "this event"}. Use this Stripe link to complete your optional donation when you're ready.`
      : `You started registering for ${draft.eventTitle || "this event"} but didn't finish payment. Use this Stripe invoice link to complete it. Your place is only confirmed after payment.`,
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
): Promise<{ newlyPaid: boolean }> => {
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
    return { newlyPaid: false }
  }

  if ( prior ) {
    return { newlyPaid: false }
  }

  await regRef.update ( {
    status: "completed",
    ...( paymentIntent ? { paymentIntent } : { } ),
    ...extra
  } )
  return { newlyPaid: !!paymentIntent }
}

const applyDonationToExistingRegistration = async (
  draftRef: DocumentReference,
  draft: CheckoutDraft,
  regRef: DocumentReference,
  existingPaymentIntent: unknown,
  paymentIntent: string | null
): Promise<void> => {
  await applyPaymentIntentSafely (
    regRef,
    existingPaymentIntent,
    paymentIntent,
    {
      donatedAt: FieldValue.serverTimestamp ( ),
      formData: draft.formData
    }
  )
  await copyStatusTokenToRegistration ( regRef.id, draft.cancelTokenHash )
  clearEventsCache ( )
  const event = await loadEvent ( draft.eventId )
  await trySendDonationFollowUpEmails ( draftRef, {
    eventId: draft.eventId,
    eventTitle: draft.eventTitle || event?.title || "the event",
    email: draft.email,
    name: draft.name,
    amountPence: draft.amountPence ?? null,
    eventDate: event ? formatEventDateForEmail ( event ) : undefined,
    eventLocation: event?.location,
    donationRequired: event?.donationRequired || "optional"
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
    const draftBeforeClaim = draftSnap.data ( ) as CheckoutDraft
    const targetRegistrationId = draftBeforeClaim.existingRegistrationId || draftId
    const draft = await claimDraftForFinalize ( draftRef, targetRegistrationId )
    if ( !draft ) {
      return
    }

    // Optional donate / existing seat — capacity already held
    if ( draft.existingRegistrationId ) {
      const regRef = db.collection ( "event_registrations" ).doc ( draft.existingRegistrationId )
      const regSnap = await regRef.get ( )
      await applyDonationToExistingRegistration (
        draftRef,
        draft,
        regRef,
        regSnap.data ( )?. [ "paymentIntent" ],
        paymentIntent
      )
      return
    }

    const existing = await findExistingRegistrationByEmail ( draft.eventId, draft.email )
    if ( existing ) {
      await applyDonationToExistingRegistration (
        draftRef,
        draft,
        existing.ref,
        existing.data ( )?. [ "paymentIntent" ],
        paymentIntent
      )
      return
    }

    // New paid seat — re-check capacity at finalize (closes TOCTOU vs register start)
    const event = await loadEvent ( draft.eventId )
    if ( event ) {
      const capacity = await resolveCapacityGate ( event )
      if ( !capacity.allow || capacity.asWaitlist ) {
        console.warn ( `Refunding payment for draft ${draftId}: event full at finalize.` )
        await refundAndCloseDraft ( draftRef, paymentIntent, "over_capacity" )
        void StaffNotifyService.notify ( {
          type: "registration",
          eventId: draft.eventId,
          eventTitle: draft.eventTitle,
          email: draft.email,
          name: draft.name,
          amountPence: draft.amountPence ?? null,
          status: "completed",
          donationRequired: event.donationRequired,
          message: "Auto-refunded: event was full when payment completed.",
          eventDate: formatEventDateForEmail ( event ),
          eventLocation: event.location
        } )
        return
      }
    }

    const regRef = db.collection ( "event_registrations" ).doc ( draftId )
    await regRef.set ( {
      eventId: draft.eventId,
      eventTitle: draft.eventTitle,
      formData: draft.formData,
      email: draft.email || null,
      status: "completed",
      attended: false,
      paymentIntent,
      ...( draft.cancelTokenHash ? { statusTokenHash: draft.cancelTokenHash } : { } ),
      createdAt: FieldValue.serverTimestamp ( ),
      donatedAt: FieldValue.serverTimestamp ( )
    }, { merge: true } )

    // Post-write capacity heal if two payments raced past the check
    if ( event?.maxAttendees && event.maxAttendees > 0 ) {
      const seats = await countConfirmedSeats ( draft.eventId )
      if ( seats > event.maxAttendees ) {
        console.warn ( `Overbook heal: removing registration ${draftId} and refunding.` )
        await regRef.delete ( )
        await refundAndCloseDraft ( draftRef, paymentIntent, "over_capacity" )
        void StaffNotifyService.notify ( {
          type: "registration",
          eventId: draft.eventId,
          eventTitle: draft.eventTitle,
          email: draft.email,
          name: draft.name,
          amountPence: draft.amountPence ?? null,
          status: "completed",
          donationRequired: event.donationRequired,
          message: "Auto-refunded after overbook race at finalize.",
          eventDate: formatEventDateForEmail ( event ),
          eventLocation: event.location
        } )
        clearEventsCache ( )
        return
      }
    }

    clearEventsCache ( )
    if ( event && draft.email ) {
      await trySendPaidRegistrationEmails ( draftRef, {
        event,
        email: draft.email,
        name: draft.name,
        status: "completed",
        amountPence: draft.amountPence ?? null
      } )
    } else {
      await trySendStaffRegistrationNotify ( draftRef, {
        type: "registration",
        eventId: draft.eventId,
        eventTitle: draft.eventTitle,
        email: draft.email,
        name: draft.name,
        amountPence: draft.amountPence ?? null,
        status: "completed"
      } )
    }
    return
  }

  // Legacy pending_payment docs (pre-deferral) — mark complete if present
  const legacyRef = db.collection ( "event_registrations" ).doc ( draftId )
  const legacySnap = await legacyRef.get ( )
  if ( legacySnap.exists ) {
    const legacyData = legacySnap.data ( ) as Record<string, unknown>
    const { newlyPaid } = await applyPaymentIntentSafely (
      legacyRef,
      legacyData [ "paymentIntent" ],
      paymentIntent,
      { donatedAt: FieldValue.serverTimestamp ( ) }
    )
    if ( newlyPaid ) {
      await sendPaymentReceivedNotificationsForRegistration ( {
        regData: legacyData,
        amountPence: typeof legacyData [ "amountPence" ] === "number" ? legacyData [ "amountPence" ] as number : null
      } )
    }
  } else {
    // Draft missing at webhook time — do not auto-refund (races caused false orphans).
    // Alert staff; payment can be reconciled or refunded manually in Stripe.
    console.warn ( `Checkout draft / registration ${draftId} was not found after payment. PI=${paymentIntent}` )
    void StaffNotifyService.notify ( {
      type: "registration",
      eventId: "unknown",
      eventTitle: "Orphan Stripe payment",
      amountPence: null,
      status: "completed",
      message: `Draft ${draftId} not found after payment. PaymentIntent=${paymentIntent || "unknown"}. Check Stripe and refund manually if needed.`
    } )
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
      await clearStaleFinalizedDraft ( draftRef, existing, draftRef.id )
      const recheck = await draftRef.get ( )
      if ( recheck.exists && ( recheck.data ( ) as CheckoutDraft ).finalized ) {
        return { ok: false, reason: "already_paid" }
      }
    } else {
      if ( existing.stripeInvoiceId ) {
        await StripeService.voidInvoiceIfOpen ( existing.stripeInvoiceId )
      }
      if ( existing.stripeCheckoutSessionId ) {
        await StripeService.expireCheckoutSession ( existing.stripeCheckoutSessionId )
      }
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
    // Keep the draft — deleting it breaks status polls / webhooks if a session was created
    await draftRef.update ( {
      checkoutUrl: null,
      stripeCheckoutSessionId: null
    } ).catch ( ( ) => null )
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

      const activeEvents = filterUpcomingEvents ( events ).map ( e => ( {
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

  /** Poll whether a checkout draft has been finalized into a paid registration. Requires cancelToken. */
  app.get ( "/checkout-draft/:draftId/status", async ( req, rep ) => {
    const { draftId } = req.params as { draftId: string }
    const cancelToken = String ( ( req.query as { cancelToken?: string } ).cancelToken || "" )
    if ( !draftId || !cancelToken ) {
      return rep.status ( 400 ).send ( { message: "Missing draft id or cancel token." } )
    }

    const db = getFirestore ( )
    const draftRef = db.collection ( "event_checkout_drafts" ).doc ( draftId )
    const draftSnap = await draftRef.get ( )
    if ( draftSnap.exists ) {
      const draft = draftSnap.data ( ) as CheckoutDraft
      if ( !draft.cancelTokenHash || !tokensMatch ( cancelToken, draft.cancelTokenHash ) ) {
        return rep.status ( 403 ).send ( { message: "Invalid cancel token." } )
      }
      if ( draft.refundedReason ) {
        return rep.send ( { status: "refunded", reason: draft.refundedReason } )
      }
      if ( draft.finalized === true ) {
        const regId = registrationIdForDraft ( draft, draftId )
        if ( await isActiveCompletedRegistration ( regId ) ) {
          return rep.send ( { status: "paid" } )
        }
        await draftRef.delete ( )
        return rep.send ( { status: "not_found" } )
      }
      return rep.send ( { status: "pending" } )
    }

    // Draft missing (race / cleanup) — fall back to registration created with the same id
    const regSnap = await db.collection ( "event_registrations" ).doc ( draftId ).get ( )
    if ( regSnap.exists && regSnap.data ( )?. [ "status" ] === "completed" ) {
      const hash = String ( regSnap.data ( )?. [ "statusTokenHash" ] || "" )
      if ( hash && tokensMatch ( cancelToken, hash ) ) {
        return rep.send ( { status: "paid" } )
      }
      // No token hash (or mismatch): do not disclose paid status without a valid cancelToken
      return rep.send ( { status: "not_found" } )
    }

    return rep.send ( { status: "not_found" } )
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

      const result = await sendPaymentPromptForDraft ( draftId, { cancelToken } )
      return rep.send ( {
        message: result.emailed
          ? "You're registered. A payment link is ready whenever you'd like to complete your optional donation."
          : "Checkout cancelled. You're still registered for the event.",
        emailed: result.emailed,
        hostedInvoiceUrl: result.hostedInvoiceUrl,
        checkoutUrl: result.hostedInvoiceUrl,
        cancelToken: result.cancelToken
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
      await RecaptchaService.verifyToken ( recaptchaToken, recaptchaContextFromRequest ( req ) )
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

    const cleanedFormData: Record<string, unknown> = {
      ...formData,
      ...( optInDonation ? { optInDonation: true } : { } ),
      ...( customDonationAmount != null ? { customDonationAmount } : { } )
    }

    // Optional opt-in: register immediately, then redirect to Stripe for the donation.
    if ( isOptionalAndOptedIn ) {
      if ( !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test ( email ) ) {
        return rep.status ( 400 ).send ( { message: "A valid email is required to register." } )
      }

      if ( !capacity.allow || capacity.asWaitlist ) {
        return rep.status ( 400 ).send ( {
          message: capacity.asWaitlist
            ? "This event is full. Register without a donation to join the waitlist, or contact us."
            : ( capacity.message || "This event is fully booked." )
        } )
      }

      const registrationRef = getFirestore ( ).collection ( "event_registrations" ).doc ( )
      await registrationRef.set ( {
        eventId,
        eventTitle: event.title,
        formData: cleanedFormData,
        email,
        status: "completed",
        attended: false,
        createdAt: FieldValue.serverTimestamp ( )
      } )
      clearEventsCache ( )

      if ( await healOverbookIfNeeded ( event, registrationRef ) ) {
        return rep.status ( 400 ).send ( { message: "This event is fully booked." } )
      }

      sendRegistrationEmails ( {
        event,
        email,
        name,
        status: "completed"
      } )

      const amountPence = customDonationPence != null ? customDonationPence : event.donationPrice
      const customAmountInPence = customDonationPence != null ? customDonationPence : undefined

      try {
        const checkout = await startOrResumeCheckout ( {
          eventId,
          event,
          email,
          name,
          formData: cleanedFormData,
          amountPence,
          customAmountInPence,
          existingRegistrationId: registrationRef.id
        } )

        if ( !checkout.ok ) {
          if ( checkout.reason === "already_paid" ) {
            return rep.status ( 400 ).send ( { message: "You are already successfully registered for this event." } )
          }
          return rep.send ( {
            message: "You're registered. We couldn't start the donation checkout — try again later or contact us.",
            status: "completed"
          } )
        }

        return rep.send ( {
          message: "You're registered. Redirecting to complete your optional donation.",
          checkoutUrl: checkout.checkoutUrl,
          draftId: checkout.draftId,
          cancelToken: checkout.cancelToken,
          status: "completed"
        } )
      } catch ( err ) {
        console.error ( "Stripe Session Creation Error:", err )
        return rep.send ( {
          message: "You're registered, but we couldn't start the donation checkout. Please contact us if you'd like to donate.",
          status: "completed"
        } )
      }
    }

    // Required donation: hold details in a checkout draft only — no registration until Stripe pays
    if ( isRequired ) {
      if ( !email ) {
        return rep.status ( 400 ).send ( { message: "Email is required to complete payment." } )
      }

      // Paid places need an open seat (waitlist is free-only)
      if ( !capacity.allow || capacity.asWaitlist ) {
        return rep.status ( 400 ).send ( {
          message: capacity.asWaitlist
            ? "This event is fully booked."
            : ( capacity.message || "This event is fully booked." )
        } )
      }

      const amountPence = customDonationPence != null ? customDonationPence : event.donationPrice
      const customAmountInPence = customDonationPence != null ? customDonationPence : undefined

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
    if ( !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test ( email ) ) {
      return rep.status ( 400 ).send ( { message: "A valid email is required to register." } )
    }

    if ( !capacity.allow ) {
      return rep.status ( 400 ).send ( { message: capacity.message || "This event is fully booked." } )
    }

    const status = capacity.asWaitlist ? "waitlist" : "completed"
    const registrationRef = getFirestore ( ).collection ( "event_registrations" ).doc ( )
    const registrationPayload: Record<string, unknown> = {
      eventId,
      eventTitle: event.title,
      formData: cleanedFormData,
      email,
      status,
      attended: false,
      createdAt: FieldValue.serverTimestamp ( )
    }

    await registrationRef.set ( registrationPayload )
    clearEventsCache ( )

    if ( status === "completed" && await healOverbookIfNeeded ( event, registrationRef ) ) {
      return rep.status ( 400 ).send ( { message: "This event is fully booked." } )
    }

    sendRegistrationEmails ( {
      event,
      email,
      name,
      status: status as "completed" | "waitlist"
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

    if ( event.type === "invoice.paid" ) {
      const invoice = event.data.object as Stripe.Invoice
      const registrationId = invoice.metadata?. [ "registrationId" ]
      if ( registrationId ) {
        const paymentRef = ( invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null } ).payment_intent
        const paymentIntent = typeof paymentRef === "string" ? paymentRef : paymentRef?.id || null
        const db = getFirestore ( )
        const docRef = db.collection ( "event_registrations" ).doc ( registrationId )
        const docSnap = await docRef.get ( )
        if ( docSnap.exists ) {
          const regData = docSnap.data ( ) as Record<string, unknown>
          const hadPayment = !!regData [ "paymentIntent" ]
          const { newlyPaid } = await applyPaymentIntentSafely (
            docRef,
            regData [ "paymentIntent" ],
            paymentIntent,
            { donatedAt: FieldValue.serverTimestamp ( ) }
          )
          if ( newlyPaid && !hadPayment ) {
            await sendPaymentReceivedNotificationsForRegistration ( {
              regData,
              amountPence: invoice.amount_paid ?? null
            } )
          }
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
