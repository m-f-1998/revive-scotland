import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "./admin.js"
import { isDevMode } from "./static.js"
import Stripe from "stripe"
import { FieldValue } from "firebase-admin/firestore"

export const router: FastifyPluginAsync = async app => {
  app.post ( "/:eventId/register", async ( req, rep ) => {
    const { eventId } = req.params as { eventId: string }
    const formData = req.body as Record<string, unknown>
    const recaptchaToken = formData?.["recaptchaToken"] as string | undefined

    if ( !recaptchaToken ) {
      return rep.status ( 400 ).send ( { message: "reCAPTCHA token missing." } )
    }

    try {
      const response = await fetch (
        "https://recaptchaenterprise.googleapis.com/v1/projects/revive-scotland/assessments?key=" + ( process.env [ "RECAPTCHA_API_KEY" ] || "" ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Referer": process.env [ "PUBLIC_DOMAIN" ] || ""
          },
          body: JSON.stringify ( {
            event: {
              token: recaptchaToken,
              siteKey: process.env [ "RECAPTCHA_SITE" ] || "",
              expectedAction: "contactForm"
            }
          } )
        }
      )

      if ( !response.ok ) return rep.status ( 500 ).send ( { message: "reCAPTCHA verification failed." } )

      const data = await response.json ( ) as { tokenProperties: { valid: boolean }; riskAnalysis: { score: number } }
      console.log ( data.tokenProperties )
      if ( !data.tokenProperties.valid || data.riskAnalysis.score < 0.5 ) {
        return rep.status ( 400 ).send ( { message: "reCAPTCHA failed." } )
      }
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

    if ( event.donationRequired && event.donationRequired !== "none" && event.stripePriceId && process.env["STRIPE_SECRET_KEY"] ) {
      const stripe = new Stripe ( process.env["STRIPE_SECRET_KEY"] )
      const host = isDevMode ( ) ? "http://localhost:4200" : "https://revivescotland.co.uk"

      const session = await stripe.checkout.sessions.create ( {
        payment_method_types: [ "card" ],
        line_items: [
          {
            price: event.stripePriceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        payment_intent_data: {
          transfer_group: eventId // Links funds into an event-specific "pot" for future multi-bank payouts
        },
        success_url: `${host}/events?registration=success`,
        cancel_url: `${host}/events?registration=cancelled`,
        client_reference_id: registrationRef.id,
      } )

      stripeUrl = session.url || undefined
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

  app.post ( "/stripe/webhook", { config: { rawBody: true } }, async ( req, rep ) => {
    const sig = req.headers["stripe-signature"] as string
    const endpointSecret = process.env["STRIPE_WEBHOOK_SECRET"]
    const stripeKey = process.env["STRIPE_SECRET_KEY"]

    if ( !sig || !endpointSecret || !stripeKey ) {
      return rep.status ( 400 ).send ( "Missing Stripe config" )
    }

    const stripe = new Stripe ( stripeKey )
    let event: Stripe.Event

    try {
      // By using config: { rawBody: true }, we can access the unparsed body directly to verify the signature
      const rawBody = JSON.stringify ( req.body )

      event = stripe.webhooks.constructEvent (
        rawBody,
        sig,
        endpointSecret
      )
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