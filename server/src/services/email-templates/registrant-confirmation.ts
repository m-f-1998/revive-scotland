import {
  emailDetailsCard,
  emailInfoPanel,
  emailLayout,
  emailStatusBadge,
  escapeHtml
} from "./layout.js"

export type RegistrantConfirmationData = {
  name?: string
  eventTitle: string
  eventDate?: string
  eventLocation?: string
  status: "completed" | "waitlist"
}

export const registrantConfirmationEmail = ( data: RegistrantConfirmationData ): { subject: string; html: string; text: string } => {
  const isWaitlist = data.status === "waitlist"
  const subject = isWaitlist
    ? `Revive Scotland — you're on the waitlist for ${data.eventTitle}`
    : `Revive Scotland — you're registered for ${data.eventTitle}`

  const greeting = data.name ? `Dear ${escapeHtml ( data.name )},` : "Hello,"
  const intro = isWaitlist
    ? "Thank you for your interest. You have been added to the waitlist and we will contact you if a place becomes available."
    : "Thank you for registering. Your place is confirmed and we look forward to seeing you there."

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">${greeting}</p>
    ${emailStatusBadge ( isWaitlist ? "Waitlist" : "Confirmed", isWaitlist ? "warning" : "success" )}
    <h2 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#1e3a5f;line-height:1.3;">${escapeHtml ( data.eventTitle )}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">${intro}</p>

    ${emailDetailsCard ( [
      ...( data.eventDate ? [ { label: "When", value: data.eventDate } ] : [ ] ),
      ...( data.eventLocation ? [ { label: "Where", value: data.eventLocation } ] : [ ] )
    ] )}

    ${emailInfoPanel ( "Please keep this email for your records. Questions? Email <a href=\"mailto:luca@revivescotland.co.uk\" style=\"color:#2563eb;text-decoration:none;\">luca@revivescotland.co.uk</a>." )}
  `

  const text = [
    data.name ? `Dear ${data.name},` : "Hello,",
    "",
    isWaitlist
      ? `You are on the waitlist for ${data.eventTitle}. We will contact you if a place opens.`
      : `Your registration for ${data.eventTitle} is confirmed.`,
    data.eventDate ? `When: ${data.eventDate}` : null,
    data.eventLocation ? `Where: ${data.eventLocation}` : null,
    "",
    "Questions? Email luca@revivescotland.co.uk"
  ].filter ( line => line !== null ).join ( "\n" )

  return {
    subject,
    html: emailLayout (
      isWaitlist ? "Waitlist Confirmation" : "Registration Confirmed",
      body,
      isWaitlist ? "We'll be in touch if a place opens up" : "We look forward to seeing you"
    ),
    text
  }
}
