import { getStaffInboxEmail } from "../utils/staff-inbox.js"

export type StaffNotifyPayload = {
  type: "registration" | "payment" | "contact"
  eventId: string
  eventTitle?: string
  email?: string | null
  name?: string
  amountPence?: number | null
  message?: string
}

/**
 * Staff notifications:
 * 1) Optional STAFF_NOTIFY_WEBHOOK (Slack/Discord/Zapier) — includes `to` inbox
 * 2) Optional RESEND_API_KEY — sends a real email to SUPERADMIN_EMAIL (else luca@…)
 */
export class StaffNotifyService {
  public static async notify ( payload: StaffNotifyPayload ): Promise<void> {
    const to = getStaffInboxEmail ( )
    const subject = StaffNotifyService.subjectFor ( payload )
    const text = StaffNotifyService.bodyFor ( payload, to )

    await Promise.allSettled ( [
      StaffNotifyService.postWebhook ( { ...payload, to, subject, text } ),
      StaffNotifyService.sendResendEmail ( { to, subject, text, replyTo: payload.email || undefined } )
    ] )
  }

  private static subjectFor ( payload: StaffNotifyPayload ): string {
    if ( payload.type === "contact" ) return "Revive Scotland — new contact form message"
    if ( payload.type === "payment" ) {
      return `Revive Scotland — payment for ${payload.eventTitle || "an event"}`
    }
    return `Revive Scotland — registration for ${payload.eventTitle || "an event"}`
  }

  private static bodyFor ( payload: StaffNotifyPayload, to: string ): string {
    const lines = [
      `To: ${to}`,
      `Type: ${payload.type}`,
      payload.eventTitle ? `Event: ${payload.eventTitle}` : null,
      payload.name ? `Name: ${payload.name}` : null,
      payload.email ? `From: ${payload.email}` : null,
      payload.amountPence != null ? `Amount: £${( payload.amountPence / 100 ).toFixed ( 2 )}` : null,
      payload.message ? `Message:\n${payload.message}` : null,
      `At: ${new Date ( ).toISOString ( )}`
    ]
    return lines.filter ( Boolean ).join ( "\n" )
  }

  private static async postWebhook ( body: Record<string, unknown> ): Promise<void> {
    const url = process.env [ "STAFF_NOTIFY_WEBHOOK" ]?.trim ( )
    if ( !url ) return

    try {
      const res = await fetch ( url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify ( {
          ...body,
          // Discord-friendly top-level content when the webhook is a Discord URL
          content: typeof body [ "text" ] === "string"
            ? String ( body [ "text" ] ).slice ( 0, 1800 )
            : undefined,
          at: new Date ( ).toISOString ( )
        } )
      } )
      if ( !res.ok ) {
        console.warn ( `Staff notify webhook returned ${res.status}` )
      }
    } catch ( err ) {
      console.warn ( "Staff notify webhook failed:", err )
    }
  }

  /** https://resend.com — set RESEND_API_KEY and optional EMAIL_FROM */
  private static async sendResendEmail ( opts: {
    to: string
    subject: string
    text: string
    replyTo?: string
  } ): Promise<void> {
    const apiKey = process.env [ "RESEND_API_KEY" ]?.trim ( )
    if ( !apiKey ) return

    const from = process.env [ "EMAIL_FROM" ]?.trim ( )
      || "Revive Scotland <onboarding@resend.dev>"

    try {
      const res = await fetch ( "https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify ( {
          from,
          to: [ opts.to ],
          subject: opts.subject,
          text: opts.text,
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
