import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "./admin.js"
import Stripe from "stripe"
import { FieldValue } from "firebase-admin/firestore"
import { RecaptchaService } from "../services/recaptcha.service.js"
import { StripeService } from "../services/stripe.service.js"

export const router: FastifyPluginAsync = async app => {
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
    const eventDoc = await getFirestore ().collection ( "events" ).doc ( eventId ).get ()

    if ( !eventDoc.exists ) {
      // Fallback check against legacy 'default' array just in case migrations are partial
      const defaultDoc = await getFirestore ().collection ( "events" ).doc ( "default" ).get ()
      const eventInArray = ( defaultDoc.data ( )?. [ "events" ] || [] ).find ( ( e: { id: string } ) => e.id === eventId )
      if ( !eventInArray ) {
        return rep.status ( 404 ).send ( { message: "Event not found." } )
      }
    }

    const event = eventDoc.exists ? eventDoc.data () : ( await getFirestore ().collection ( "events" ).doc ( "default" ).get () ).data ()?.["events"]?.find ( ( e: { id: string } ) => e.id === eventId )

    const registrationRef = getFirestore ().collection ( "event_registrations" ).doc ()

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
      createdAt: FieldValue.serverTimestamp ()
    } )

    return rep.send ( { 
      message: "Registration recorded.",
      checkoutUrl: stripeUrl
    } )
  } )

  app.post ( "/stripe/webhook", async ( req, rep ) => {
    const sig = req.headers["stripe-signature"] as string

    if ( !sig ) {
      return rep.status ( 400 ).send ( "Missing Stripe signature" )
    }

    let event: Stripe.Event

    try {
      event = StripeService.constructWebhookEvent ( JSON.stringify ( req.body ), sig )
    } catch ( err ) {
      console.error ( "Webhook Error:", err )
      return rep.status ( 400 ).send ( `Webhook Error` )
    }

    if ( event.type === "checkout.session.completed" ) {
      const session = event.data.object as Stripe.Checkout.Session
      if ( session.client_reference_id ) {
        await getFirestore ().collection ( "event_registrations" ).doc ( session.client_reference_id ).update ( {
          status: "completed",
          paymentIntent: session.payment_intent
        } )
      }
    }

    return rep.send ( { received: true } )
  } )
}