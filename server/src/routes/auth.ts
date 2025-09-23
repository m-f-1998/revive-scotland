import type { Request, Response } from "express"
import { Router } from "express"

import { rateLimit } from "express-rate-limit"
import { pool } from "../db.js"
import { issueToken, sessionActive, useRefreshToken, verifyPassword, verifyToken } from "../auth.js"
import { isDevMode } from "../server.js"

export const router = Router ( )

router.use ( rateLimit ( {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    status: 429,
    message: "Too many requests, please try again later."
  }
} ) )

router.post ( "/login", async ( req: Request, res: Response ) => {
  const username = req.body?.username
  const password = req.body?.password

  if ( !username || !password ) {
    res.status ( 400 ).json ( {
      status: 400,
      message: "Username and password are required."
    } )
    return
  }

  try {
    const client = await pool!.query ( "SELECT password_salt, password_hash FROM users WHERE username = $1", [ username ] )

    if ( client.rowCount === 0 ) {
      res.status ( 401 ).json ( {
        status: 401,
        message: "Invalid username or password."
      } )
      return
    }

    const { password_salt, password_hash } = client.rows [ 0 ]

    const isPasswordValid = verifyPassword ( password, password_salt, password_hash )

    if ( !isPasswordValid ) {
      res.status ( 401 ).json ( {
        status: 401,
        message: "Invalid username or password."
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

    res.status ( 200 ).json ( {
      accessToken: tokens.accessToken.token
    } )
  } catch ( error ) {
    console.error ( "Error while authenticating:", error )
    res.status ( 500 ).json ( {
      status: 500,
      message: "Internal server error."
    } )
    return
  }
} )

router.post ( "/status", async ( req: Request, res: Response ) => {
  // Return if logged in, logout if not
  const accessToken = req.cookies [ "accessToken" ]
  const refreshToken = req.cookies [ "refreshToken" ]

  if ( ! ( await sessionActive ( accessToken ) ) ) {
    console.log ( `Session inactive or expired` )
    res.status ( 401 ).json ( {
      status: 401,
      message: "Session inactive or expired."
    } )
    return
  }

  const payload = await verifyToken ( accessToken, true )

  if ( !payload ) {
    if ( refreshToken ) {
      const refreshed = await useRefreshToken ( refreshToken )
      if ( refreshed ) {
        res.cookie ( "accessToken", refreshed.token, {
          httpOnly: true,
          secure: !isDevMode ( ),
          sameSite: "strict",
          maxAge: refreshed.age
        } )

        req.headers.authorization = `Bearer ${ refreshed.token }`
        await pool!.query ( "UPDATE sessions SET session_token = $1, last_active = $2 WHERE session_token = $3", [ refreshed.token, new Date ( ), accessToken ] )

        res.status ( 200 ).json ( {
          status: 200,
          isLoggedIn: true,
          accessToken: refreshed.token
        } )
        return
      }
    }
    res.status ( 200 ).json ( {
      status: 200,
      isLoggedIn: false,
      accessToken: null
    } )
    return
  }

  res.status ( 200 ).json ( {
    status: 200,
    isLoggedIn: true,
    accessToken
  } )
} )

router.post ( "/logout", async ( req: Request, res: Response ) => {
  const accessToken = req.cookies [ "accessToken" ]
  const refreshToken = req.cookies [ "refreshToken" ]

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
    const accessPayload = await verifyToken ( accessToken, true )
    const refreshPayload = await verifyToken ( refreshToken, false )

    if ( accessPayload ) {
      await pool!.query ( "INSERT INTO blacklistedTokens ( jti, expires_at ) VALUES ( $1, to_timestamp( $2 ) )", [ accessPayload.jti, accessPayload.exp ] )
    }

    if ( refreshPayload ) {
      await pool!.query ( "INSERT INTO blacklistedTokens ( jti, expires_at ) VALUES ( $1, to_timestamp( $2 ) )", [ refreshPayload.jti, refreshPayload.exp ] )
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