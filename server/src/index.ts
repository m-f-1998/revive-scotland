import express from "express"
// import type { Response } from "express"
import helmet from "helmet"

import cors from "cors"
import { randomBytes } from "crypto"

import { router as mailerRouter } from "./routes/mailer.js"
import { isDevMode, router as staticRouter } from "./routes/static.js"
import { router as imagesRouter } from "./routes/images.js"
import { router as adminRouter } from "./routes/admin.js"
import { router as publicRouter } from "./routes/admin/public.js"

const app = express ( )

app.use ( express.json ( ) )
app.use ( express.urlencoded ( { extended: true } ) )

app.use ( express.json ( { limit: "1mb" } ) )
app.use ( express.urlencoded ( { limit: "1mb", extended: true } ) )

app.use ( cors ( {
  origin: [
    "http://localhost:3000",
    "http://localhost:4200",
    "https://revivescotland.co.uk"
  ],
  methods: [ "GET", "POST", "DELETE" ],
  allowedHeaders: [ "Content-Type", "Authorization" ],
  credentials: true
} ) )

app.use ( ( _req, res, next ) => {
  const nonce = randomBytes ( 16 ).toString ( "base64" )
  res.locals [ "cspNonce" ] = nonce
  next ( )
} )

app.use ( helmet ( {
  frameguard: {
    action: "deny"
  },
  hidePoweredBy: true,
  crossOriginResourcePolicy: isDevMode ( ) ? false : { policy: "same-origin" },
  crossOriginOpenerPolicy: {
    policy: "same-origin-allow-popups"
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [
        "'none'",
      ],
      scriptSrc: [
        "'self'",
        "www.googletagmanager.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        // ( _req, res ) => `'nonce-${( res as Response ).locals[ "cspNonce" ]}'`
      ],
      scriptSrcElem: [
        "'self'",
        "'unsafe-inline'",
        "https://www.youtube.com",
        "https://www.googletagmanager.com",
        "https://static.cloudflareinsights.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://apis.google.com"
        // ( _req, res ) => `'nonce-${( res as Response ).locals[ "cspNonce" ]}'`
      ],
      scriptSrcAttr: [
        "'unsafe-inline'"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://\*.jsdelivr.net",
        "https://lh3.googleusercontent.com"
      ],
      connectSrc: [
        "'self'",
        "https://\*.google-analytics.com",
        "https://\*.google.com",
        "https://cloudflareinsights.com",
        "https://identitytoolkit.googleapis.com",
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com",
        "https://revive-scotland-admin.firebaseapp.com"
      ],
      mediaSrc: [
        "'self'"
      ],
      manifestSrc: [
        "'self'"
      ],
    }
  },
  noSniff: true,
  xssFilter: true,
  ieNoOpen: true
} ) )

app.use ( "/api/mailer", mailerRouter )
app.use ( "/api/img", imagesRouter )
app.use ( "/api/admin", adminRouter )
app.use ( "/api/public", publicRouter )
app.use ( staticRouter )

app.listen ( 3000, ( ) => {
  console.log ( "Server running on port 3000" )
} )
