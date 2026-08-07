/**
 * Optional staff notifications via an HTTP webhook (Slack/Discord/etc.).
 * Set STAFF_NOTIFY_WEBHOOK to a URL that accepts JSON POST bodies.
 */
export class StaffNotifyService {
  public static async notify ( payload: {
    type: "registration" | "payment" | "contact"
    eventId: string
    eventTitle?: string
    email?: string | null
    name?: string
    amountPence?: number | null
    message?: string
  } ): Promise<void> {
    const url = process.env [ "STAFF_NOTIFY_WEBHOOK" ]?.trim ( )
    if ( !url ) return

    try {
      const res = await fetch ( url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify ( {
          ...payload,
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
}
