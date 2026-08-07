export const getEmailPublicOrigin = ( ): string => {
  return ( process.env [ "PUBLIC_DOMAIN" ]?.trim ( ) || "https://revivescotland.co.uk" ).replace ( /\/$/, "" )
}

export const EMAIL_LOGO_CONTENT_ID = "revive-logo"

export const getEmailLogoSrc = ( ): string => {
  return `cid:${EMAIL_LOGO_CONTENT_ID}`
}

/** Remote fallback when inline logo file is unavailable (must request PNG for email clients). */
export const getEmailLogoUrl = ( ): string => {
  return `${getEmailPublicOrigin ( )}/api/img/logo.png?w=160&f=png`
}

export const emailLayout = ( title: string, bodyHtml: string, subtitle?: string ): string => {
  const logoSrc = getEmailLogoSrc ( )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml ( title )}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Georgia,'Times New Roman',serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#1e3a5f 0%,#eef2f7 240px);padding:32px 16px 48px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 12px 40px rgba(30,58,95,0.12);">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 32px 24px;text-align:center;">
              <!-- Shrink-wrapped table + align="center" — reliable logo centering in Outlook/Gmail -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center" style="padding:0 0 16px;line-height:0;font-size:0;text-align:center;">
                    <!--[if mso]>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="120">
                      <tr>
                        <td align="center">
                    <![endif]-->
                    <img src="${escapeHtml ( logoSrc )}" alt="Revive Scotland" width="120" height="54" border="0" align="center" style="display:block;width:120px;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
                    <!--[if mso]>
                        </td>
                      </tr>
                    </table>
                    <![endif]-->
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#bfdbfe;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;">Revive Scotland</p>
              ${subtitle ? `<p style="margin:10px 0 0;color:#dbeafe;font-size:13px;font-style:italic;line-height:1.5;">${escapeHtml ( subtitle )}</p>` : ""}
              <h1 style="margin:${subtitle ? "10px" : "8px"} 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.35;">${escapeHtml ( title )}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 32px;font-size:15px;line-height:1.7;color:#374151;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-style:italic;">Bringing young Catholics to life in Christ</p>
              <p style="margin:0;font-size:12px;color:#64748b;">
                <a href="${escapeHtml ( getEmailPublicOrigin ( ) )}" style="color:#2563eb;text-decoration:none;font-weight:600;">revivescotland.co.uk</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export const escapeHtml = ( value: string ): string => {
  return value
    .replace ( /&/g, "&amp;" )
    .replace ( /</g, "&lt;" )
    .replace ( />/g, "&gt;" )
    .replace ( /"/g, "&quot;" )
    .replace ( /'/g, "&#39;" )
}

export type EmailDetailRow = {
  label: string
  value: string
  href?: string
}

export const emailDetailsCard = ( rows: EmailDetailRow [ ] ): string => {
  const visible = rows.filter ( row => row.value )
  if ( visible.length === 0 ) return ""

  const rowsHtml = visible.map ( row => {
    const valueHtml = row.href
      ? `<a href="${escapeHtml ( row.href )}" style="color:#2563eb;text-decoration:none;">${escapeHtml ( row.value )}</a>`
      : escapeHtml ( row.value )
    return `<tr>
      <td style="padding:12px 16px 12px 0;border-bottom:1px solid #e2e8f0;width:108px;vertical-align:top;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-family:Arial,Helvetica,sans-serif;">${escapeHtml ( row.label )}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:15px;color:#1e293b;vertical-align:top;">${valueHtml}</td>
    </tr>`
  } ).join ( "" )

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:4px 18px;">${rowsHtml}</table>`
}

export type EmailBadgeTone = "success" | "warning" | "payment" | "neutral"

export const emailStatusBadge = ( label: string, tone: EmailBadgeTone ): string => {
  const palette: Record<EmailBadgeTone, { bg: string; text: string; border: string }> = {
    success: { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
    warning: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    payment: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
    neutral: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" }
  }
  const colors = palette [ tone ]
  return `<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${escapeHtml ( label )}</span>`
}

export const emailMessageBlock = ( label: string, message: string ): string => {
  return `
    <p style="margin:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-family:Arial,Helvetica,sans-serif;">${escapeHtml ( label )}</p>
    <div style="padding:16px 18px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;white-space:pre-wrap;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml ( message )}</div>
  `
}

export const emailHighlightAmount = ( amount: string ): string => {
  return `<p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#1e3a5f;line-height:1.2;">${escapeHtml ( amount )}</p>`
}

export const emailNotePanel = ( html: string ): string => {
  return `<div style="margin:18px 0 0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:14px;line-height:1.6;color:#9a3412;">${html}</div>`
}

export const emailInfoPanel = ( html: string ): string => {
  return `<div style="margin:18px 0 0;padding:14px 16px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 10px 10px 0;font-size:14px;line-height:1.6;color:#1e40af;">${html}</div>`
}

export const formatEmailTimestamp = ( date = new Date ( ) ): string => {
  return new Intl.DateTimeFormat ( "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London"
  } ).format ( date )
}

/** @deprecated Use emailDetailsCard */
export const detailRow = ( label: string, value: string ): string => {
  return `<p style="margin:0 0 10px;"><strong style="color:#1e3a5f;">${escapeHtml ( label )}:</strong> ${escapeHtml ( value )}</p>`
}
