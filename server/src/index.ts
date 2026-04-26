import Fastify, { FastifyReply, FastifyRequest } from "fastify"
import pino from "pino"
import zlib from "zlib"
import { IncomingMessage } from "http"

import helmet from "@fastify/helmet"
import compress from "@fastify/compress"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import sensible from "@fastify/sensible"
import formbody from "@fastify/formbody"
import cors from "@fastify/cors"

import { isDevMode, router as staticRouter } from "./routes/static.js"
import { router as mailerRouter } from "./routes/mailer.js"
import { router as imagesRouter } from "./routes/images.js"
import { router as adminRouter } from "./routes/admin.js"
import { router as publicRouter } from "./routes/admin/public.js"

import { randomBytes } from "crypto"

const app = Fastify ( {
  logger: false,
  // logger: {
  //   level: isDevMode ( ) ? "debug" : "warn",
  //   redact: { paths: [ "req.headers.authorization", "req.headers.cookie" ], censor: "[REDACTED]" }
  // },
  trustProxy: "loopback",
  // http2: true
} )

await app.register ( sensible )
await app.register ( cookie )
await app.register ( formbody )

await app.register ( compress, {
  threshold: 1024 * 20,
  zlibOptions: {
    flush: zlib.constants.Z_SYNC_FLUSH // Forces chunks to be sent immediately
  }
} )

await app.register ( cors, {
  origin: ( origin, callback ) => {
    const allowedOrigins = [ "http://localhost:4200", "http://localhost:3000", "https://revivescotland.co.uk", "https://dev.revivescotland.co.uk" ]
    if ( !origin || allowedOrigins.includes ( origin ) ) {
      callback ( null, true )
    } else {
      callback ( new Error ( "Not allowed by CORS" ), false )
    }
  },
  methods: [ "GET", "POST", "DELETE" ],
  allowedHeaders: [ "Content-Type", "Authorization" ],
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
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
} )

app.addHook ( "onRequest", async ( req, _reply ) => {
  req.startTime = Date.now ( )
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
        "www.googletagmanager.com"
      ],
      styleSrc: [
        "'self'",
        // ( req: IncomingMessage ) => {
        //   if ( req.cspNonce ) {
        //     return `'nonce-${req.cspNonce}'`
        //   }
        //   return ""
        // },
        "'unsafe-inline'"
      ],
      scriptSrcElem: [
        "'self'",
        "'unsafe-inline'",
        // ( req: IncomingMessage ) => {
        //   if ( req.cspNonce ) {
        //     return `'nonce-${req.cspNonce}'`
        //   }
        //   return ""
        // },
        "https://www.youtube.com",
        "https://www.googletagmanager.com",
        "https://static.cloudflareinsights.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://apis.google.com"
      ],
      scriptSrcAttr: [
        "'unsafe-inline'"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://\*.jsdelivr.net",
        "https://lh3.googleusercontent.com",
        "https://googletagmanager.com",
        "https://\*.r2.cloudflarestorage.com"
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
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
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

app.addHook ( "onRequest", async request => {
  const nonce = randomBytes ( 16 ).toString ( "base64" )
  request.cspNonce = nonce
  ;( request.raw as IncomingMessage ).cspNonce = nonce
} )

app.register ( mailerRouter, { prefix: "/api/mailer" } )
app.register ( imagesRouter, { prefix: "/api/img" } )
app.register ( adminRouter, { prefix: "/api/admin" } )
app.register ( publicRouter, { prefix: "/api/public" } )
app.register ( staticRouter, { prefix: "/" } )

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