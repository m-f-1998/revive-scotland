import {
  emailDetailsCard,
  emailHighlightAmount,
  emailLayout,
  emailNotePanel,
  emailStatusBadge,
  escapeHtml
} from "./layout.js"

export type StaffRegistrationEmailData = {
  eventTitle: string
  name?: string
  email?: string | null
  status?: "completed" | "waitlist"
  eventDate?: string
  eventLocation?: string
  amountPence?: number | null
  donationRequired?: "none" | "optional" | "required"
  message?: string
}

const formatAmount = ( amountPence: number ): string =>
  `£${( amountPence / 100 ).toFixed ( 2 )}`

const paymentSummary = ( data: StaffRegistrationEmailData ): string | null => {
  if ( data.amountPence == null || data.amountPence <= 0 ) return null
  if ( data.donationRequired === "required" ) {
    return "Required registration payment received via Stripe."
  }
  if ( data.donationRequired === "optional" ) {
    return "Optional donation received via Stripe."
  }
  return "Payment received via Stripe."
}

export const staffRegistrationEmail = ( data: StaffRegistrationEmailData ): { subject: string; html: string; text: string } => {
  const isWaitlist = data.status === "waitlist"
  const statusLabel = isWaitlist ? "Waitlist" : "Confirmed"
  const hasPayment = data.amountPence != null && data.amountPence > 0
  const amount = hasPayment ? formatAmount ( data.amountPence! ) : null
  const paymentText = paymentSummary ( data )

  const subject = data.message
    ? `Revive Scotland — registration alert: ${data.eventTitle}`
    : `Revive Scotland — new registration: ${data.eventTitle}`

  const body = `
    ${emailStatusBadge ( data.message ? "Alert" : statusLabel, data.message ? "neutral" : isWaitlist ? "warning" : "success" )}
    <h2 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#1e3a5f;line-height:1.3;">${escapeHtml ( data.eventTitle )}</h2>
    <p style="margin:0 0 4px;font-size:15px;color:#334155;">A new event registration has been submitted on the website.</p>
    ${hasPayment && amount ? emailHighlightAmount ( amount ) : ""}
    ${paymentText ? `<p style="margin:${hasPayment ? "8px" : "0"} 0 16px;font-size:14px;color:#64748b;">${escapeHtml ( paymentText )}</p>` : ""}

    ${emailDetailsCard ( [
      { label: "Status", value: statusLabel },
      ...( data.name ? [ { label: "Name", value: data.name } ] : [ ] ),
      ...( data.email ? [ { label: "Email", value: data.email, href: `mailto:${data.email}` } ] : [ ] ),
      ...( hasPayment && amount ? [ { label: "Payment", value: amount } ] : [ ] ),
      ...( data.eventDate ? [ { label: "When", value: data.eventDate } ] : [ ] ),
      ...( data.eventLocation ? [ { label: "Where", value: data.eventLocation } ] : [ ] )
    ] )}

    ${data.message ? emailNotePanel ( `<strong>Note:</strong> ${escapeHtml ( data.message )}` ) : ""}
  `

  const text = [
    data.message ? "Registration alert" : "New event registration",
    `Event: ${data.eventTitle}`,
    `Status: ${statusLabel}`,
    data.name ? `Name: ${data.name}` : null,
    data.email ? `Email: ${data.email}` : null,
    hasPayment && amount ? `Payment: ${amount}` : null,
    paymentText,
    data.eventDate ? `When: ${data.eventDate}` : null,
    data.eventLocation ? `Where: ${data.eventLocation}` : null,
    data.message ? `Note: ${data.message}` : null
  ].filter ( Boolean ).join ( "\n" )

  let subtitle = isWaitlist ? "Someone joined the waitlist" : "Someone registered for an event"
  if ( hasPayment && data.donationRequired === "required" ) {
    subtitle = "Paid registration confirmed"
  } else if ( hasPayment && data.donationRequired === "optional" ) {
    subtitle = "Registration with optional donation"
  }

  return {
    subject,
    html: emailLayout ( "New Registration", body, subtitle ),
    text
  }
}
