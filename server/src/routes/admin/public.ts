import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getFirestore } from "../admin.js" // Your existing firebase admin export
// import { Readable } from "stream"
import { FastifyPluginAsync } from "fastify"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import rateLimit from "@fastify/rate-limit"
import { isDevMode } from "../static.js"
import Stripe from "stripe"
import { FieldValue } from "firebase-admin/firestore"

// Duplicate env setup or import from a shared config file
const R2_ACCOUNT_ID = process.env [ "R2_ACCOUNT_ID" ]
const R2_ACCESS_KEY_ID = process.env [ "R2_ACCESS_KEY_ID" ]
const R2_SECRET_ACCESS_KEY = process.env [ "R2_SECRET_ACCESS_KEY" ]
const R2_BUCKET_NAME = process.env [ "R2_BUCKET_NAME" ]
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

const s3Client = new S3Client ( {
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  }
} )

interface CachedShare {
  data?: FirebaseFirestore.DocumentData
  expiresAt: number // timestamp in ms
}

const shareCache = new Map<string, CachedShare> ()

export const router: FastifyPluginAsync = async app => {
  if ( !isDevMode ( ) ) {
    await app.register ( rateLimit, {
      max: 60,
      timeWindow: "1 minute"
    } )
  }

  /**
   * PUBLIC ROUTE: /s/:id
   * This is the link users click (e.g., revivescotland.co.uk/api/public/s/abc-123)
   */
  app.get ( "/s/:id", async ( req, rep ) => {
    const { id } = req.params as { id?: string }

    if ( !id ) {
      return rep.status ( 400 ).send ( "Missing share ID." )
    }

    try {
      const docRef = getFirestore ( ).collection ( "shared_links" ).doc ( id )
      let data
      const cached = shareCache.get ( id )
      if ( cached && Date.now ( ) < cached.expiresAt ) {
        data = cached.data
      } else {
        shareCache.delete ( id )
        const snap = await docRef.get ( )
        if ( !snap.exists ) {
          return rep.status ( 404 ).send ( "File not found or link has been revoked." )
        }
        data = snap.data ( )
      }

      if ( data?. [ "expiresAt" ] ) {
        const now = new Date ( )
        const expiry = data [ "expiresAt" ].toDate ( ) // Firestore Timestamp conversion
        if ( now > expiry ) {
          shareCache.delete ( id )
          await docRef.delete ( )
          return rep.status ( 410 ).send ( "This link has expired." )
        }
      }

      if ( !data?. [ "key" ] ) {
        return rep.status ( 500 ).send ( "Invalid share record." )
      }

      const command = new GetObjectCommand ( {
        Bucket: R2_BUCKET_NAME,
        Key: data?. [ "key" ],
      } )

      shareCache.set ( id, { data, expiresAt: Date.now ( ) + 60 * 1000 } ) // 1 min cache

      const signedUrl = await getSignedUrl ( s3Client, command, {
        expiresIn: 60 * 5 // 5 minutes
      } )

      return rep.redirect ( signedUrl )
    } catch ( error ) {
      console.error ( "Public Share Error:", error )
      return rep.status ( 500 ).send ( "Error retrieving file." )
    }
  } )

  app.post ( "/events/:eventId/register", async ( req, rep ) => {
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

    const eventsDoc = await getFirestore ().collection ( "events" ).doc ( "default" ).get ()
    const event = ( eventsDoc.data ( )?. [ "events" ] || [] ).find ( ( e: { id: string } ) => e.id === eventId )

    if ( !event ) {
      return rep.status ( 404 ).send ( { message: "Event not found." } )
    }

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

  app.post ( "/stripe/webhook", async ( req, rep ) => {
    const sig = req.headers["stripe-signature"]
    const endpointSecret = process.env["STRIPE_WEBHOOK_SECRET"]
    const stripeKey = process.env["STRIPE_SECRET_KEY"]

    if ( !sig || !endpointSecret || !stripeKey ) {
      return rep.status ( 400 ).send ( "Missing Stripe config" )
    }

    const stripe = new Stripe ( stripeKey )
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent (
        JSON.stringify ( req.body ), // fallback
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