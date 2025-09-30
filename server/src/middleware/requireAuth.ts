import type { Request, Response, NextFunction } from "express"
import { sessionActive, useRefreshToken, verifyToken } from "../auth.js"
import { isDevMode } from "../server.js"
import { pool } from "../db.js"

export const requireAuth = async ( req: Request, res: Response, next: NextFunction ) => {
  const authHeader = req.cookies [ "accessToken" ] || req.headers.authorization || ""
  if ( !authHeader || !authHeader.startsWith ( "Bearer " ) ) {
    res.status ( 401 ).json ( {
      status: 401,
      message: "Authorization header missing or invalid."
    } )
    return
  }

  const accessToken = authHeader.split ( " " ) [ 1 ]

  if ( ! ( await sessionActive ( accessToken ) ) ) {
    res.status ( 401 ).json ( {
      status: 401,
      message: "Session inactive or expired."
    } )
    return
  }

  const payload = await verifyToken ( accessToken, true )

  if ( !payload ) {
    const refreshToken = req.cookies [ "refreshToken" ]
    if ( !refreshToken ) {
      res.status ( 401 ).json ( {
        status: 401,
        message: "Invalid or expired token."
      } )
      return
    }

    const refreshed = await useRefreshToken ( refreshToken )
    if ( refreshed ) {
      res.cookie ( "accessToken", refreshed.token, {
        httpOnly: true,
        secure: !isDevMode ( ),
        sameSite: "strict",
        maxAge: refreshed.age
      } )

      req.headers.authorization = `Bearer ${ refreshed.token }`
      // Update session last active time and token with the new token
      await pool!.query ( "UPDATE sessions SET session_token = $1, last_active = $2 WHERE session_token = $3", [ refreshed.token, new Date ( ), accessToken ] )

      next ( )
      return
    }

    res.status ( 401 ).json ( {
      status: 401,
      message: "Invalid or expired refresh token."
    } )
    return
  }

  next ( )
}