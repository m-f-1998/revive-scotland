import express from "express"
// import type { Response } from "express"
import helmet from "helmet"

import cors from "cors"
import { router as mailerRouter } from "./routes/mailer.js"
import { router as staticRouter } from "./routes/static.js"
import { router as eventRouter } from "./routes/events.js"
import { router as authRouter } from "./routes/auth.js"
import { router as headersRouter } from "./routes/headers.js"

import { randomBytes } from "crypto"
import { rateLimit } from "express-rate-limit"
import { initDB, pool } from "./db.js"
import { updateEnv } from "./env.js"
import { hashPassword } from "./auth.js"

const app = express ( )

app.use ( express.json ( ) )
app.use ( express.urlencoded ( { extended: true } ) )

app.use ( express.json ( { limit: "1mb" } ) )
app.use ( express.urlencoded ( { limit: "1mb", extended: true } ) )

app.use ( cors ( {
  origin: [
    "http://localhost:3000",
    "https://revivescotland.co.uk"
  ],
  methods: [ "GET", "POST" ],
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
        // ( _req, res ) => `'nonce-${( res as Response ).locals[ "cspNonce" ]}'`
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://\*.jsdelivr.net",
      ],
      connectSrc: [
        "'self'",
        "https://\*.google-analytics.com",
        "https://\*.google.com",
        "https://cloudflareinsights.com"
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com"
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

app.use ( "/assets", rateLimit ( {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
} ) )

app.use ( "/api/events", eventRouter )
app.use ( "/api/mailer", mailerRouter )
app.use ( "/api/auth", authRouter )
app.use ( "/api/headers", headersRouter )
app.use ( staticRouter )

export const isDevMode = ( ) => process.env [ "DEV_MODE" ] === "true" || process.env [ "DEV_MODE" ] === "1"

const preloadDB = async ( ) => {
  const users = await pool!.query ( "SELECT COUNT(*) FROM users" )
  if ( Number ( users.rows [ 0 ].count ) === 0 ) {
    console.log ( "No users found in db, creating initial admin user..." )
    const username = process.env [ "ADMIN_USERNAME" ]
    const email = process.env [ "ADMIN_EMAIL" ]
    const password = process.env [ "ADMIN_PASSWORD" ]

    if ( !username || !email || !password ) {
      console.error ( "Admin user details are not fully set in environment variables." )
      process.exit ( 1 )
    }

    const { hash, salt } = hashPassword ( password )
    await pool!.query ( "INSERT INTO users ( username, email, password_hash, password_salt, role ) VALUES ( $1, $2, $3, $4, $5 )", [ username, email, hash, salt, "admin" ] )
    console.log ( `Admin user created with username: ${username} and email: ${email}` )
  }

  const headers = await pool!.query ( "SELECT COUNT(*) FROM headers" )

  if ( Number ( headers.rows [ 0 ].count ) === 0 ) {
    console.log ( "No headers found in db, creating initial header..." )
    await pool!.query ( "INSERT INTO headers ( filename, title, description, location ) VALUES ( $1, $2, $3, $4 )", [ "/assets/img/hero-bg-1.jpg", "Revive Scotland", "We are dedicated to reviving the faith in people's hearts through the power of the Holy Spirit. We deliver this through formation, community and prayer; mainly Pilgrimages, Revive Weekends and Eucharistic Adoration.", "/" ] )
    await pool!.query ( "INSERT INTO headers ( filename, title, description, location ) VALUES ( $1, $2, $3, $4 )", [ "/assets/img/hero-bg-2.jpg", "Join the Prayer", "Revive exists to give people a real and transformational HOPE, through a FAITH filled lifestyle centered on the sacraments, catechesis and real authentic friendships as a way to encounter God's LOVE.", "/" ] )
    await pool!.query ( "INSERT INTO headers ( filename, title, description, location ) VALUES ( $1, $2, $3, $4 )", [ "/assets/img/hero-bg-3.jpg", "God is Love", "'Let anyone who is thirsty come to me and drink. Whoever believes in me, as Scripture has said, rivers of living water will flow from within them. By this he meant the Holy Spirit' (Jn 7:38-39)", "/" ] )
    await pool!.query ( "INSERT INTO headers ( filename, title, description, location ) VALUES ( $1, $2, $3, $4 )", [ "/assets/img/hero-bg-4.jpg", "Upcoming Events", "Revive Scotland", "/events" ] )
    await pool!.query ( "INSERT INTO headers ( filename, title, description, location ) VALUES ( $1, $2, $3, $4 )", [ "/assets/img/hero-bg-5.jpg", "Upcoming Events", "Revive Scotland", "/events" ] )
    console.log ( "Initial headers created." )
  }

  const events = await pool!.query ( "SELECT COUNT(*) FROM events" )

  if ( Number ( events.rows [ 0 ].count ) === 0 ) {
    console.log ( "No events found in db, creating initial event..." )

    await pool!.query ( `INSERT INTO events ( "title", "description", "latitude", "longitude", "showcase_image", "start", "end", "goto_event_link", "location_name" ) VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9 )`, [ "Revive Weekend for Young Adults", "Dare to be Wise, Begin!", "57.63663222627872", "-3.565196553620845", "/assets/img/kinloss-weekend.jpg", new Date ( "2025-10-17" ), new Date ( "2025-10-19" ), "https://stmaryscathedral.churchsuite.com/events/artezvmj", "Cumming Hall" ] )
    console.log ( "Initial event created." )
  }
}

initDB ( ).then ( async ( ) => {
  await Promise.all ( [
    preloadDB ( ),
    !process.env [ "WEB_SECRET" ] || !process.env [ "ENCRYPTION_SECRET" ] ? updateEnv ( {
      "WEB_SECRET":  randomBytes ( 64 ).toString ( "hex" ),
      "ENCRYPTION_SECRET": randomBytes ( 32 ).toString ( "hex" )
    } ) : Promise.resolve ( )
  ] )
} ).then ( ( ) => {
  console.log ( "Preload complete." )
  app.listen ( 3000, ( ) => {
    console.log ( "Server running on port 3000" )
  } )
} ).catch ( error => {
  console.error ( "Error during preload:", error )
  process.exit ( 1 )
} )
