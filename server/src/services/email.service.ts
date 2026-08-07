import { readFile } from "fs/promises"
import { join } from "path"
import { getStaffInboxRecipients } from "../utils/staff-inbox.js"
import { EMAIL_LOGO_CONTENT_ID, getEmailLogoSrc, getEmailLogoUrl } from "./email-templates/layout.js"
import { staffContactEmail } from "./email-templates/staff-contact.js"
import { staffRegistrationEmail } from "./email-templates/staff-registration.js"
import { staffPaymentReceivedEmail } from "./email-templates/staff-payment-received.js"
import { registrantConfirmationEmail } from "./email-templates/registrant-confirmation.js"
import { registrantPaymentReceivedEmail } from "./email-templates/registrant-payment-received.js"

const LOGO_PATH = join ( process.cwd ( ), "../assets/img/logo.png" )

type InlineLogoAttachment = {
  filename: string
  content: string
  content_id: string
  content_type: string
}

let inlineLogoCache: InlineLogoAttachment | null | undefined

const loadInlineLogoAttachment = async ( ): Promise<InlineLogoAttachment | null> => {
  if ( inlineLogoCache !== undefined ) {
    return inlineLogoCache
  }
  try {
    const content = ( await readFile ( LOGO_PATH ) ).toString ( "base64" )
    inlineLogoCache = {
      filename: "logo.png",
      content,
      content_id: EMAIL_LOGO_CONTENT_ID,
      content_type: "image/png"
    }
  } catch {
    inlineLogoCache = null
  }
  return inlineLogoCache
}

const prepareEmailHtml = async ( html: string ): Promise<{ html: string; attachments?: InlineLogoAttachment [ ] }> => {
  const logo = await loadInlineLogoAttachment ( )
  if ( logo ) {
    return { html, attachments: [ logo ] }
  }
  return {
    html: html.replaceAll ( getEmailLogoSrc ( ), getEmailLogoUrl ( ) ),
  }
}

export type StaffNotifyPayload = {
  type: "registration" | "contact" | "payment_received"
  eventId: string
  eventTitle?: string
  email?: string | null
  name?: string
  amountPence?: number | null
  message?: string
  status?: "completed" | "waitlist"
  eventDate?: string
  eventLocation?: string
  donationRequired?: "none" | "optional" | "required"
}

export type RegistrantConfirmationPayload = {
  to: string
  name?: string
  eventTitle: string
  eventDate?: string
  eventLocation?: string
  status: "completed" | "waitlist"
}

export type RegistrantPaymentReceivedPayload = {
  to: string
  name?: string
  eventTitle: string
  eventDate?: string
  eventLocation?: string
  amountPence?: number | null
}

/**
 * Email delivery via Resend (https://resend.com).
 * Set RESEND_API_KEY and optional EMAIL_FROM in the environment.
 */
export class EmailService {
  public static async notifyStaff ( payload: StaffNotifyPayload ): Promise<void> {
    const to = getStaffInboxRecipients ( )
    let rendered: { subject: string; html: string; text: string }

    if ( payload.type === "contact" ) {
      rendered = staffContactEmail ( {
        name: payload.name || "Unknown",
        email: payload.email || "",
        message: payload.message || "",
        submittedAt: new Date ( )
      } )
    } else if ( payload.type === "payment_received" ) {
      rendered = staffPaymentReceivedEmail ( {
        eventTitle: payload.eventTitle || "an event",
        name: payload.name,
        email: payload.email,
        amountPence: payload.amountPence,
        eventDate: payload.eventDate,
        eventLocation: payload.eventLocation,
        donationRequired: payload.donationRequired === "required" || payload.donationRequired === "optional"
          ? payload.donationRequired
          : undefined
      } )
    } else {
      rendered = staffRegistrationEmail ( {
        eventTitle: payload.eventTitle || "an event",
        name: payload.name,
        email: payload.email,
        status: payload.status,
        eventDate: payload.eventDate,
        eventLocation: payload.eventLocation,
        amountPence: payload.amountPence,
        donationRequired: payload.donationRequired,
        message: payload.message
      } )
    }

    await EmailService.send ( {
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: payload.email || undefined
    } )
  }

  public static async sendRegistrantConfirmation ( payload: RegistrantConfirmationPayload ): Promise<void> {
    const rendered = registrantConfirmationEmail ( {
      name: payload.name,
      eventTitle: payload.eventTitle,
      eventDate: payload.eventDate,
      eventLocation: payload.eventLocation,
      status: payload.status
    } )

    await EmailService.send ( {
      to: payload.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text
    } )
  }

  public static async sendRegistrantPaymentReceived ( payload: RegistrantPaymentReceivedPayload ): Promise<void> {
    const rendered = registrantPaymentReceivedEmail ( {
      name: payload.name,
      eventTitle: payload.eventTitle,
      eventDate: payload.eventDate,
      eventLocation: payload.eventLocation,
      amountPence: payload.amountPence
    } )

    await EmailService.send ( {
      to: payload.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text
    } )
  }

  private static async send ( opts: {
    to: string | string [ ]
    subject: string
    html: string
    text: string
    replyTo?: string
  } ): Promise<void> {
    const apiKey = process.env [ "RESEND_API_KEY" ]?.trim ( )
    if ( !apiKey ) {
      console.warn ( "RESEND_API_KEY not set — email not sent:", opts.subject )
      return
    }

    const from = process.env [ "EMAIL_FROM" ]?.trim ( )
      || "Revive Scotland <onboarding@resend.dev>"

    const prepared = await prepareEmailHtml ( opts.html )
    const recipients = Array.isArray ( opts.to ) ? opts.to : [ opts.to ]

    try {
      const res = await fetch ( "https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify ( {
          from,
          to: recipients,
          subject: opts.subject,
          html: prepared.html,
          text: opts.text,
          ...( prepared.attachments ? { attachments: prepared.attachments } : { } ),
          ...( opts.replyTo ? { reply_to: opts.replyTo } : { } )
        } )
      } )
      if ( !res.ok ) {
        const detail = await res.text ( ).catch ( ( ) => "" )
        console.warn ( `Resend email failed (${res.status}):`, detail.slice ( 0, 300 ) )
      }
    } catch ( err ) {
      console.warn ( "Resend email failed:", err )
    }
  }
}
