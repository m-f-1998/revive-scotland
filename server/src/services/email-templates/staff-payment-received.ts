import {
  emailDetailsCard,
  emailHighlightAmount,
  emailLayout,
  emailStatusBadge,
  escapeHtml
} from "./layout.js"

export type StaffPaymentReceivedEmailData = {
  eventTitle: string
  name?: string
  email?: string | null
  amountPence?: number | null
  eventDate?: string
  eventLocation?: string
  donationRequired?: "optional" | "required"
}

const formatAmount = ( amountPence: number ): string =>
  `£${( amountPence / 100 ).toFixed ( 2 )}`

export const staffPaymentReceivedEmail = ( data: StaffPaymentReceivedEmailData ): { subject: string; html: string; text: string } => {
  const amount = data.amountPence != null && data.amountPence > 0
    ? formatAmount ( data.amountPence )
    : null

  const who = data.name || data.email || "A registrant"
  const subject = amount
    ? `Revive Scotland — payment received: ${amount} for ${data.eventTitle}`
    : `Revive Scotland — payment received for ${data.eventTitle}`

  const intro = amount
    ? `${escapeHtml ( who )} has completed a payment of ${escapeHtml ( amount )} for the event below.`
    : `${escapeHtml ( who )} has completed a payment for the event below.`

  const paymentNote = data.donationRequired === "required"
    ? "Required registration payment received via Stripe."
    : data.donationRequired === "optional"
      ? "Optional donation received via Stripe."
      : "Payment received via Stripe."

  const body = `
    ${emailStatusBadge ( "Payment received", "payment" )}
    <h2 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#1e3a5f;line-height:1.3;">${escapeHtml ( data.eventTitle )}</h2>
    <p style="margin:0 0 4px;font-size:15px;color:#334155;">${intro}</p>
    ${amount ? emailHighlightAmount ( amount ) : ""}
    <p style="margin:${amount ? "8px" : "0"} 0 16px;font-size:14px;color:#64748b;">${escapeHtml ( paymentNote )}</p>

    ${emailDetailsCard ( [
      ...( data.name ? [ { label: "Name", value: data.name } ] : [ ] ),
      ...( data.email ? [ { label: "Email", value: data.email, href: `mailto:${data.email}` } ] : [ ] ),
      ...( amount ? [ { label: "Amount", value: amount } ] : [ ] ),
      ...( data.eventDate ? [ { label: "When", value: data.eventDate } ] : [ ] ),
      ...( data.eventLocation ? [ { label: "Where", value: data.eventLocation } ] : [ ] )
    ] )}
  `

  const text = [
    "Payment received",
    `Event: ${data.eventTitle}`,
    data.name ? `Name: ${data.name}` : null,
    data.email ? `Email: ${data.email}` : null,
    amount ? `Amount: ${amount}` : null,
    paymentNote,
    data.eventDate ? `When: ${data.eventDate}` : null,
    data.eventLocation ? `Where: ${data.eventLocation}` : null
  ].filter ( Boolean ).join ( "\n" )

  return {
    subject,
    html: emailLayout ( "Payment Received", body, amount ? `${who} paid ${amount}` : "A registrant completed payment" ),
    text
  }
}
