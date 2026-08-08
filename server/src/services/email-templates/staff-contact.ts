import {
  emailDetailsCard,
  emailLayout,
  emailMessageBlock,
  formatEmailTimestamp
} from "./layout.js"

export type StaffContactEmailData = {
  name: string
  email: string
  message: string
  submittedAt?: Date
}

export const staffContactEmail = ( data: StaffContactEmailData ): { subject: string; html: string; text: string } => {
  const submitted = formatEmailTimestamp ( data.submittedAt || new Date ( ) )
  const subject = `Revive Scotland — message from ${data.name}`

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1e293b;">New message from the website contact form.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#64748b;">Reply in your email app — the sender's address is already set as the reply-to.</p>

    ${emailDetailsCard ( [
      { label: "Name", value: data.name },
      { label: "Email", value: data.email, href: `mailto:${data.email}` },
      { label: "Received", value: submitted }
    ] )}

    ${emailMessageBlock ( "Message", data.message )}
  `

  const text = [
    "New contact form message",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Received: ${submitted}`,
    "",
    "Message:",
    data.message
  ].join ( "\n" )

  return {
    subject,
    html: emailLayout ( "Contact Form Message", body ),
    text
  }
}
