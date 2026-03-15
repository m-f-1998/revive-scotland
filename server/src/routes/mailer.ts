import { createTransport } from "nodemailer"
import { config } from "dotenv"
import { resolve } from "path"
import sanitizeHtml from "sanitize-html"
import { FastifyPluginAsync } from "fastify"

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

export const router: FastifyPluginAsync = async app => {
  app.post ( "/", async ( req, rep ) => {
    const { subject, message, recaptchaToken } = req.body as { subject?: string; message?: string; recaptchaToken?: string }

    if ( !subject || !message || !recaptchaToken ) {
      return rep.status ( 400 ).send ( { message: "Invalid input." } )
    }

    if ( !subject || !recaptchaToken || !message ) {
      return rep.status ( 400 ).send ( { message: "Invalid input." } )
    }

    try {
      const response = await fetch (
        "https://recaptchaenterprise.googleapis.com/v1/projects/revive-scotland/assessments?key=" + ( process.env [ "RECAPTCHA_API_KEY" ] || "" ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Referer": process.env [ "PUBLIC_DOMAIN" ] || ""
          },
          body: JSON.stringify ( {
            event: {
              token: recaptchaToken,
              siteKey: process.env [ "RECAPTCHA_SITE" ] || "",
              expectedAction: "contactForm"
            }
          } )
        }
      )

      if ( !response.ok ) {
        return rep.status ( 500 ).send ( { message: "reCAPTCHA verification failed." } )
      }

      const data = await response.json ( ) as {
        tokenProperties: {
          valid: boolean
        }
        riskAnalysis: {
          score: number
        }
      }
      if ( !data.tokenProperties.valid || data.riskAnalysis.score < 0.5 ) {
        console.warn ( "reCAPTCHA verification failed:", data )
        return rep.status ( 400 ).send ( { message: "reCAPTCHA failed." } )
      }
    } catch ( err ) {
      console.error ( "reCAPTCHA verification error:", err )
      return rep.status ( 500 ).send ( { message: "reCAPTCHA verification error." } )
    }

    if ( !process.env [ "SMTP_HOST" ] || !process.env [ "SMTP_PORT" ] ||
        !process.env [ "SMTP_USER" ] || !process.env [ "SMTP_PASS" ] ||
        !process.env [ "SMTP_DESTINATION" ] ) {
      return rep.status ( 500 ).send ( { message: "SMTP configuration is missing." } )
    }

    const transporter = createTransport ( {
      host: process.env [ "SMTP_HOST" ],
      port: Number ( process.env [ "SMTP_PORT" ] ),
      secure: true,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      dnsTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: process.env [ "SMTP_USER" ],
        pass: process.env [ "SMTP_PASS" ],
      },
    } )

    try {
      await transporter.sendMail ( {
        from: process.env [ "SMTP_USER" ],
        to: process.env [ "SMTP_DESTINATION" ],
        subject,
        html: sanitizeHtml ( message, {
          allowedTags: sanitizeHtml.defaults.allowedTags, // customize as needed
          allowedAttributes: sanitizeHtml.defaults.allowedAttributes
        } ),
        encoding: "utf8"
      } )
      return rep.status ( 200 ).send ( { message: "Email sent successfully" } )
    } catch ( err ) {
      return rep.status ( 500 ).send ( { message: "Email send failed", error: ( err as Error ).message } )
    }
  } )
}