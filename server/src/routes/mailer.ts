import { Router } from "express"
import type { Request, Response } from "express"
import { rateLimit } from "express-rate-limit"
import { createTransport } from "nodemailer"
import { config } from "dotenv"
import { resolve } from "path"
import sanitizeHtml from "sanitize-html"

export const router = Router ( )

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

router.use ( rateLimit ( { // limit each IP to 20 requests per hour
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
} ) )

router.post ( "/", async ( req: Request, res: Response ) => {
  if ( !req.body?.subject || !req.body?.message || !req.body?.recaptchaToken ) {
    res.status ( 400 ).json ( { message: "Invalid input." } )
    return
  }

  const { subject, message, recaptchaToken } = req.body

  if ( !subject || !recaptchaToken || !message ) {
    res.status ( 400 ).json ( { message: "Invalid input." } )
    return
  }

  try {
    const response = await fetch (
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams ( {
          secret: process.env [ "RECAPTCHA_SECRET_KEY" ] || "",
          response: recaptchaToken,
          remoteip: req.ip || "",
        } ).toString ( )
      }
    )

    if ( !response.ok ) {
      res.status ( 500 ).json ( { message: "reCAPTCHA verification failed." } )
      return
    }

    const data: any = await response.json ( )
    if ( !data.success || data.score < 0.5 ) {
      console.warn ( "reCAPTCHA verification failed:", data )
      res.status ( 400 ).json ( { message: "reCAPTCHA failed." } )
      return
    }
  } catch ( err: any ) {
    console.error ( "reCAPTCHA verification error:", err )
    res.status ( 500 ).json ( { message: "reCAPTCHA verification error." } )
    return
  }

  if ( !process.env [ "SMTP_HOST" ] || !process.env [ "SMTP_PORT" ] ||
       !process.env [ "SMTP_USER" ] || !process.env [ "SMTP_PASS" ] ||
       !process.env [ "SMTP_DESTINATION" ] ) {
    res.status ( 500 ).json ( { message: "SMTP configuration is missing." } )
    return
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
    res.status ( 200 ).json ( { message: "Email sent successfully" } )
  } catch ( err: any ) {
    res.status ( 500 ).json ( { message: "Email send failed", error: err.message } )
  }
} )
