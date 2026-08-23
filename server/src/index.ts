import Fastify, { FastifyReply, FastifyRequest, type FastifyServerOptions } from "fastify"
import pino from "pino"
import zlib from "zlib"
import { IncomingMessage } from "http"

import helmet from "@fastify/helmet"
import compress from "@fastify/compress"
import { fastifyCookie as cookie } from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import sensible from "@fastify/sensible"
import formbody from "@fastify/formbody"
import cors from "@fastify/cors"

import { isDevMode, router as staticRouter } from "./routes/static.js"
import { router as imagesRouter } from "./routes/images.js"
import { router as adminRouter } from "./routes/admin.js"
import { router as shareRouter } from "./routes/share.js"
import { router as eventsRouter } from "./routes/events.js"
import { router as contactRouter } from "./routes/contact.js"

import { router as galleryRouter } from "./routes/gallery.js"
import { router as feastRouter } from "./routes/feast.js"
import { router as contentRouter } from "./routes/content.js"

import { randomBytes } from "crypto"

const REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME",
  "SUPERADMIN_EMAIL",
  ...( isDevMode ( ) ? [ ] : [ "RECAPTCHA_API_KEY", "RECAPTCHA_SITE" ] )
]

if ( process.env [ "NODE_ENV" ] === "production" && isDevMode ( ) ) {
  console.error ( "CRITICAL: DEV_MODE must not be enabled when NODE_ENV=production." )
  process.exit ( 1 )
}

const missingVars = REQUIRED_ENV_VARS.filter ( v => !process.env [ v ] )
if ( missingVars.length > 0 ) {
  console.error ( `Missing required environment variables: ${missingVars.join ( ", " )}` )
  if ( !isDevMode ( ) ) process.exit ( 1 )
}

const trustProxyEnv = process.env [ "TRUST_PROXY" ]?.trim ( )

const resolveTrustProxy = ( value: string | undefined ): NonNullable<FastifyServerOptions [ "trustProxy" ]> => {
  if ( !value || value.length === 0 ) return "loopback"
  if ( value === "true" ) return true
  if ( value === "false" ) return false
  if ( /^\d+$/.test ( value ) ) {
    // Numeric hop counts are accepted at runtime but omitted from Fastify types.
    return true
  }
  return value
}

const app = Fastify ( {
  logger: false,
  // logger: {
  //   level: isDevMode ( ) ? "debug" : "warn",
  //   redact: { paths: [ "req.headers.authorization", "req.headers.cookie" ], censor: "[REDACTED]" }
  // },
  // Default loopback; set TRUST_PROXY=1 (or a hop count / CIDR list) behind CDN/reverse proxy
  trustProxy: resolveTrustProxy ( trustProxyEnv ),
  // http2: true
} )

await app.register ( sensible )
await app.register ( cookie )
await app.register ( formbody )

await app.register ( compress, {
  threshold: 1024,
  zlibOptions: {
    flush: zlib.constants.Z_SYNC_FLUSH // Forces chunks to be sent immediately
  }
} )

await app.register ( cors, {
  origin: ( origin, callback ) => {
    const corsEnv = process.env [ "CORS_ORIGINS" ]
    const allowedOrigins = corsEnv ? corsEnv.split ( "," ).map ( s => s.trim ( ) ) : [ "http://localhost:4200", "http://localhost:3000" ]
    if ( !origin || allowedOrigins.includes ( origin ) ) {
      callback ( null, true )
    } else {
      callback ( null, false ) // Reject properly without causing a 500 error
    }
  },
  methods: [ "GET", "POST", "DELETE", "PUT", "PATCH" ],
  allowedHeaders: [ "Content-Type", "Authorization", "stripe-signature" ],
  credentials: true
} )

if ( !isDevMode ( ) ) {
  await app.register ( rateLimit, {
    max: 2000,
    timeWindow: "1 minute"
  } )
}

const logger: pino.Logger = pino ( {
  level: "info",
  ...( isDevMode ( ) ? {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  } : { } )
} )

app.addHook ( "onRequest", async ( req, _reply ) => {
  req.startTime = Date.now ( )
} )

// Must run before helmet so the CSP nonce is available when the header is built
app.addHook ( "onRequest", async request => {
  const nonce = randomBytes ( 16 ).toString ( "base64" )
  request.cspNonce = nonce
  ;( request.raw as IncomingMessage ).cspNonce = nonce
} )

// Add hook to flag slow requests
app.addHook ( "onResponse", async ( req, reply ) => {
  await logResponse ( req, reply )
} )

await app.register ( helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [
        "'none'",
      ],
      scriptSrc: [
        "'self'",
        "www.googletagmanager.com",
        ( req: IncomingMessage ) => req.cspNonce ? `'nonce-${req.cspNonce}'` : "",
      ],
      // Nonce covers Angular-injected <style> tags (via CSP_NONCE).
      styleSrc: [
        "'self'",
        ( req: IncomingMessage ) => req.cspNonce ? `'nonce-${req.cspNonce}'` : "",
      ],
      // Required for Angular CDK overlay / toastr positioning (element.style.*).
      // Nonces do not apply to style attributes.
      styleSrcAttr: [
        "'unsafe-inline'",
      ],
      scriptSrcElem: [
        "'self'",
        ( req: IncomingMessage ) => req.cspNonce ? `'nonce-${req.cspNonce}'` : "",
        "https://www.youtube.com",
        "https://www.googletagmanager.com",
        "https://static.cloudflareinsights.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://apis.google.com"
      ],
      scriptSrcAttr: [
        "'none'"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://\*.jsdelivr.net",
        "https://lh3.googleusercontent.com",
        "https://googletagmanager.com",
        "https://\*.r2.cloudflarestorage.com",
        "https://img.youtube.com"
      ],
      connectSrc: [
        "'self'",
        "https://\*.google-analytics.com",
        "https://\*.google.com",
        "https://cloudflareinsights.com",
        "https://identitytoolkit.googleapis.com",
        "https://nominatim.openstreetmap.org",
        "https://\*.r2.cloudflarestorage.com",
        "https://\*.googleapis.com"
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com",
        "https://revive-scotland-admin.firebaseapp.com",
        "https://revive-scotland-dev.firebaseapp.com"
      ],
      mediaSrc: [
        "'self'"
      ],
      manifestSrc: [
        "'self'"
      ],
    }
  },
  crossOriginOpenerPolicy: false,
  frameguard: { action: "deny" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
} )

export const logResponse = ( req: FastifyRequest, reply: FastifyReply, isProxy = false ) => {
  const remoteIp = req.ip || req.headers [ "x-forwarded-for" ] as string || req.socket?.remoteAddress || "unknown"
  const body: {
    method: string
    url: string
    status: number
    responseType: string | number | string[] | undefined
    responseTime?: string
    isProxy?: boolean
    remoteIp: string
  } = {
    method: req.method,
    url: req.url,
    status: reply.statusCode,
    responseType: reply.getHeader ( "Content-Type" ),
    remoteIp
  }

  if ( !isProxy ) {
    const start = req.startTime || Date.now ( )
    const duration = Date.now ( ) - start
    body [ "responseTime" ] = `${duration}ms`
  } else {
    body [ "isProxy" ] = true
  }

  logger.info ( body )
}

await app.register ( imagesRouter, { prefix: "/api/img" } )
await app.register ( galleryRouter, { prefix: "/api/gallery" } )
await app.register ( contentRouter, { prefix: "/api/content" } )
await app.register ( adminRouter, { prefix: "/api/admin" } )
await app.register ( shareRouter, { prefix: "/api/share" } )
await app.register ( shareRouter, { prefix: "/api/public/s" } )
await app.register ( eventsRouter, { prefix: "/api/events" } )
await app.register ( contactRouter, { prefix: "/api/contact" } )
await app.register ( feastRouter, { prefix: "/api/feast" } )
await app.register ( staticRouter, { prefix: "/" } )

console.log ( "Server is starting..." )

await app.listen ( {
  port: 3000,
  host: "0.0.0.0" // Exposed on all ipv4 interfaces for Docker compatibility
} )

console.log ( "Server is running on port 3000" )
declare module "fastify" {
  interface FastifyRequest {
    cspNonce: string
    startTime: number
  }
}

declare module "http" {
  interface IncomingMessage {
    cspNonce?: string // This is the critical one for the CSP callback
  }
}