const verifyPassword = ( password: string, storedSalt: string, storedHash: string ): boolean => {
  const hash = crypto.pbkdf2Sync ( password, storedSalt, ITERATIONS, KEYLEN, DIGEST ).toString ( "hex" )

  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual (
    Buffer.from ( storedHash, "hex" ),
    Buffer.from ( hash, "hex" )
  )
}

// const hashPassword = ( password: string ): {
//   salt: string
//   hash: string
// } => {
//   const salt = crypto.randomBytes ( 32 ).toString ( "hex" ) // 32-byte salt
//   const hash = crypto.pbkdf2Sync ( password, salt, ITERATIONS, KEYLEN, DIGEST ).toString ( "hex" )
//   return { salt, hash }
// }

import type { NextFunction, Request, Response } from "express"
import { Router } from "express"

import { rateLimit } from "express-rate-limit"
import { pool } from "../db.js"
import crypto from "crypto"

const ITERATIONS = 310000
const KEYLEN = 64
const DIGEST = "sha512"

export const router = Router ( )

router.use ( rateLimit ( {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    status: 429,
    error: "Too many requests, please try again later."
  }
} ) )

router.post ( "/login", async ( req: Request, res: Response ) => {
  const username = req.body.username
  const password = req.body.password

  if ( !username || !password ) {
    res.status ( 400 ).json ( {
      status: 400,
      error: "Username and password are required."
    } )
    return
  }

  try {
    const client = await pool.query ( "SELECT password_salt, password_hash FROM users WHERE username = $1", [ username ] )

    if ( client.rowCount === 0 ) {
      res.status ( 401 ).json ( {
        status: 401,
        error: "Invalid username or password."
      } )
      return
    }

    const { password_salt, password_hash } = client.rows [ 0 ]

    const isPasswordValid = verifyPassword ( password, password_salt, password_hash )

    if ( !isPasswordValid ) {
      res.status ( 401 ).json ( {
        status: 401,
        error: "Invalid username or password."
      } )
      return
    }

    const basicAuthHeader = "Basic " + Buffer.from ( `${username}:${password}` ).toString ( "base64" )
    res.setHeader ( "Authorization", basicAuthHeader )
    res.status ( 200 ).json ( {
      status: 200,
      token: Buffer.from ( `${username}:${password}` ).toString ( "base64" )
    } )
    return
  } catch ( error ) {
    console.error ( "Error while authenticating:", error )
    res.status ( 500 ).json ( {
      status: 500,
      error: "Internal server error."
    } )
    return
  }
} )

router.post ( "/verify", async ( req: Request, res: Response ) => {
  const authHeader = req.headers.authorization
  console.log ( authHeader, req.headers )
  if ( !authHeader || !authHeader.startsWith ( "Basic " ) ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Authorization header missing or invalid."
    } )
    return
  }

  const base64Credentials = authHeader.split ( " " ) [ 1 ]
  const credentials = Buffer.from ( base64Credentials, "base64" ).toString ( "utf8" )
  const [ username, password ] = credentials.split ( ":" )

  if ( !username || !password ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Username and password required in Authorization header."
    } )
    return
  }

  try {
    const client = await pool.query ( "SELECT password_salt, password_hash FROM users WHERE username = $1", [ username ] )

    if ( client.rowCount === 0 ) {
      res.status ( 401 ).json ( {
        status: 401,
        error: "Invalid credentials."
      } )
      return
    }

    const { password_salt, password_hash } = client.rows[0]
    const isPasswordValid = verifyPassword ( password, password_salt, password_hash )

    if ( !isPasswordValid ) {
      res.status ( 401 ).json ( {
        status: 401,
        error: "Invalid credentials."
      } )
      return
    }
    res.status ( 200 ).json ( { status: 200, message: "Token is valid." } )
  } catch ( error ) {
    console.error ( "Error while verifying token:", error )
    res.status ( 500 ).json ( {
      status: 500,
      error: "Internal server error."
    } )
  }
} )

export const isAuthenticated = ( req: Request, res: Response, next: NextFunction ) => {
  const authHeader = req.headers.authorization
  if ( !authHeader || !authHeader.startsWith ( "Basic " ) ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Authorization header missing or invalid."
    } )
    return
  }

  const base64Credentials = authHeader.split ( " " ) [ 1 ]
  const credentials = Buffer.from ( base64Credentials, "base64" ).toString ( "utf8" )
  const [ username, password ] = credentials.split ( ":" )

  if ( !username || !password ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Username and password required in Authorization header."
    } )
    return
  }

  pool.query ( "SELECT password_salt, password_hash FROM users WHERE username = $1", [ username ] )
    .then ( client => {
      if ( client.rowCount === 0 ) {
        res.status ( 401 ).json ( {
          status: 401,
          error: "Invalid credentials."
        } )
        return
      }
      const { password_salt, password_hash } = client.rows[0]
      if ( !verifyPassword ( password, password_salt, password_hash ) ) {
        res.status ( 401 ).json ( {
          status: 401,
          error: "Invalid credentials."
        } )
        return
      }
      next ()
    } )
    .catch ( error => {
      console.error ( "Error in basicAuthMiddleware:", error )
      res.status ( 500 ).json ( {
        status: 500,
        error: "Internal server error."
      } )
    } )
}