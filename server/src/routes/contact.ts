import { FastifyPluginAsync } from "fastify"
import rateLimit from "@fastify/rate-limit"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestore } from "./admin.js"
import { RecaptchaService, recaptchaContextFromRequest } from "../services/recaptcha.service.js"
import { RecaptchaAction } from "../utils/recaptcha-actions.js"
import { StaffNotifyService } from "../services/staff-notify.service.js"
import { getStaffInboxEmail } from "../utils/staff-inbox.js"
import { isDevMode } from "./static.js"
import { checkFirebaseAuth } from "./admin/middleware/fileExplorer.js"

const MAX_MESSAGE = 2000

export const router: FastifyPluginAsync = async app => {
  await app.register ( rateLimit, {
    max: isDevMode ( ) ? 60 : 8,
    timeWindow: "10 minute"
  } )

  /**
   * POST /api/contact
   * Public inquiry form (reCAPTCHA + optional staff webhook).
   */
  app.post ( "/", async ( req, rep ) => {
    const body = ( req.body || { } ) as {
      name?: string
      email?: string
      message?: string
      recaptchaToken?: string
    }

    const name = String ( body.name || "" ).trim ( ).slice ( 0, 120 )
    const email = String ( body.email || "" ).toLowerCase ( ).trim ( ).slice ( 0, 200 )
    const message = String ( body.message || "" ).trim ( ).slice ( 0, MAX_MESSAGE )
    const recaptchaToken = body.recaptchaToken

    if ( !name || !email || !message ) {
      return rep.status ( 400 ).send ( { message: "Name, email, and message are required." } )
    }
    if ( !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test ( email ) ) {
      return rep.status ( 400 ).send ( { message: "Please enter a valid email address." } )
    }
    if ( !recaptchaToken ) {
      return rep.status ( 400 ).send ( { message: "reCAPTCHA token missing." } )
    }

    try {
      await RecaptchaService.verifyToken ( recaptchaToken, {
        ...recaptchaContextFromRequest ( req ),
        expectedAction: RecaptchaAction.contactSubmit
      } )
    } catch ( err ) {
      console.error ( "Contact reCAPTCHA error:", err )
      return rep.status ( 403 ).send ( { message: "reCAPTCHA verification failed. Please try again." } )
    }

    const doc = {
      name,
      email,
      message,
      status: "new",
      notifyTo: getStaffInboxEmail ( ),
      createdAt: FieldValue.serverTimestamp ( )
    }

    const ref = await getFirestore ( ).collection ( "contact_inquiries" ).add ( doc )

    void StaffNotifyService.notify ( {
      type: "contact",
      eventId: "contact_inquiry",
      eventTitle: "Website contact form",
      email,
      name,
      message
    } )

    return rep.status ( 200 ).send ( { message: "Message sent.", id: ref.id } )
  } )

  /** Admin: recent inquiries */
  app.get ( "/inquiries", { preHandler: checkFirebaseAuth }, async ( _req, rep ) => {
    try {
      const snap = await getFirestore ( )
        .collection ( "contact_inquiries" )
        .orderBy ( "createdAt", "desc" )
        .limit ( 50 )
        .get ( )

      const inquiries = snap.docs.map ( d => {
        const data = d.data ( )
        return {
          id: d.id,
          name: data [ "name" ],
          email: data [ "email" ],
          message: data [ "message" ],
          status: data [ "status" ] || "new",
          createdAt: data [ "createdAt" ]?.toDate ?. ( )?.toISOString ( ) || null
        }
      } )

      return rep.send ( { inquiries } )
    } catch ( error ) {
      console.error ( "Error listing contact inquiries:", error )
      return rep.status ( 500 ).send ( { error: "Failed to load inquiries." } )
    }
  } )
}
