import type { Request, Response } from "express"
import { Router } from "express"

import { rateLimit } from "express-rate-limit"
import { pool } from "../db.js"
import { issueToken, verifyPassword, verifyToken } from "../auth.js"
import { isDevMode } from "../index.js"

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
    const client = await pool!.query ( "SELECT password_salt, password_hash FROM users WHERE username = $1", [ username ] )

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

    const tokens = await issueToken ( { sub: username } )
    res.cookie ( "accessToken", tokens.accessToken.token, {
      httpOnly: true,
      secure: !isDevMode ( ),
      sameSite: "strict",
      maxAge: tokens.accessToken.age
    } )

    res.cookie ( "refreshToken", tokens.refreshToken.token, {
      httpOnly: true,
      secure: !isDevMode ( ),
      sameSite: "strict",
      maxAge: tokens.refreshToken.age
    } )

    res.status ( 200 ).json ( await issueToken ( { sub: username } ) )
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

  if ( !authHeader || !authHeader.startsWith ( "Bearer " ) ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Authorization header missing or invalid."
    } )
    return
  }

  const token = authHeader.split ( " " ) [ 1 ]

  const payload = await verifyToken ( token )

  if ( !payload ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Invalid or expired token."
    } )
    return
  }

  res.status ( 200 ).json ( {
    status: 200,
    message: "Token is valid.",
    payload
  } )
} )

router.post ( "/logout", async ( req: Request, res: Response ) => {
  const accessToken = req.cookies.accessToken
  const refreshToken = req.cookies.refreshToken

  if ( !refreshToken || !accessToken ) {
    res.status ( 200 ).json ( {
      status: 200,
      message: "Logged out successfully."
    } )
    return
  }

  res.clearCookie ( "accessToken" )
  res.clearCookie ( "refreshToken" )
  // Insert access token and refresh token jti into blacklistedTokens table
  try {
    const accessPayload = await verifyToken ( accessToken )
    const refreshPayload = await verifyToken ( refreshToken )

    if ( accessPayload ) {
      await pool!.query ( "INSERT INTO blacklistedTokens ( jti, expiresAt ) VALUES ( $1, to_timestamp( $2 ) )", [ accessPayload.jti, accessPayload.exp ] )
    }
    if ( refreshPayload ) {
      await pool!.query ( "INSERT INTO blacklistedTokens ( jti, expiresAt ) VALUES ( $1, to_timestamp( $2 ) )", [ refreshPayload.jti, refreshPayload.exp ] )
    }
  } catch ( error ) {
    console.error ( "Error while logging out:", error )
    // Even if there's an error, we still clear the cookies
  }

  res.status ( 200 ).json ( {
    status: 200,
    message: "Logged out successfully."
  } )
} )

router.post ( "/refresh", async ( req: Request, res: Response ) => {
  const accessToken = req.cookies.accessToken
  const refreshToken = req.cookies.refreshToken

  if ( !refreshToken ) {
    res.status ( 401 ).json ( {
      status: 401,
      error: "Refresh token missing."
    } )
    return
  }

  try {
    const accessPayload = await verifyToken ( accessToken )
    if ( accessPayload ) {
      res.status ( 200 ).json ( {
        status: 200,
        message: "Access token is still valid, no need to refresh."
      } )
      return
    }

    const payload = await verifyToken ( refreshToken )

    if ( !payload ) {
      res.status ( 401 ).json ( {
        status: 401,
        error: "Invalid or expired refresh token."
      } )
      return
    }

    // Check if jti is blacklisted
    const client = await pool!.query ( "SELECT COUNT(*) FROM blacklistedTokens WHERE jti = $1", [ payload.jti ] )
    if ( client.rows [ 0 ].count > 0 ) {
      res.status ( 401 ).json ( {
        status: 401,
        error: "Refresh token has been revoked."
      } )
      return
    }

    const tokens = await issueToken ( { sub: payload.sub } )

    res.cookie ( "accessToken", tokens.accessToken.token, {
      httpOnly: true,
      secure: !isDevMode ( ),
      sameSite: "strict",
      maxAge: tokens.accessToken.age
    } )

    res.status ( 200 ).json ( {
      status: 200,
      message: "Token refreshed successfully."
    } )
  } catch ( error ) {
    console.error ( "Error while refreshing token:", error )
    res.status ( 500 ).json ( {
      status: 500,
      error: "Internal server error."
    } )
    return
  }
} )