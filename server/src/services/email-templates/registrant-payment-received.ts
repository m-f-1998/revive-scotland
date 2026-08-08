import {
  emailDetailsCard,
  emailHighlightAmount,
  emailInfoPanel,
  emailLayout,
  emailStatusBadge,
  escapeHtml
} from "./layout.js"

export type RegistrantPaymentReceivedData = {
  name?: string
  eventTitle: string
  eventDate?: string
  eventLocation?: string
  amountPence?: number | null
}

const formatAmount = ( amountPence: number ): string =>
  `£${( amountPence / 100 ).toFixed ( 2 )}`

export const registrantPaymentReceivedEmail = ( data: RegistrantPaymentReceivedData ): { subject: string; html: string; text: string } => {
  const amount = data.amountPence != null && data.amountPence > 0
    ? formatAmount ( data.amountPence )
    : null

  const subject = `Revive Scotland — payment received for ${data.eventTitle}`
  const greeting = data.name ? `Dear ${escapeHtml ( data.name )},` : "Hello,"

  const intro = amount
    ? `Thank you — we have received your payment of ${escapeHtml ( amount )} for your registration to the event below.`
    : `Thank you — we have received your payment for your registration to the event below.`

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">${greeting}</p>
    ${emailStatusBadge ( "Payment received", "payment" )}
    <h2 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#1e3a5f;line-height:1.3;">${escapeHtml ( data.eventTitle )}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">${intro}</p>
    ${amount ? emailHighlightAmount ( amount ) : ""}
    <p style="margin:${amount ? "8px" : "0"} 0 16px;font-size:15px;color:#334155;">Your registration remains confirmed. We look forward to seeing you there.</p>

    ${emailDetailsCard ( [
      ...( data.eventDate ? [ { label: "When", value: data.eventDate } ] : [ ] ),
      ...( data.eventLocation ? [ { label: "Where", value: data.eventLocation } ] : [ ] ),
      ...( amount ? [ { label: "Amount", value: amount } ] : [ ] )
    ] )}

    ${emailInfoPanel ( "Please keep this email for your records. Questions? Email <a href=\"mailto:luca@revivescotland.co.uk\" style=\"color:#2563eb;text-decoration:none;\">luca@revivescotland.co.uk</a>." )}
  `

  const text = [
    data.name ? `Dear ${data.name},` : "Hello,",
    "",
    amount
      ? `We have received your payment of ${amount} for your registration to ${data.eventTitle}.`
      : `We have received your payment for your registration to ${data.eventTitle}.`,
    "Your registration remains confirmed.",
    data.eventDate ? `When: ${data.eventDate}` : null,
    data.eventLocation ? `Where: ${data.eventLocation}` : null,
    amount ? `Amount: ${amount}` : null,
    "",
    "Questions? Email luca@revivescotland.co.uk"
  ].filter ( line => line !== null ).join ( "\n" )

  return {
    subject,
    html: emailLayout ( "Payment Received", body, "Thank you for your support" ),
    text
  }
}
