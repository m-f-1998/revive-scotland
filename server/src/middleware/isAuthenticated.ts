import type { Request, Response, NextFunction } from "express"
import { useRefreshToken, verifyToken } from "../auth.js"
import { isDevMode } from "../server.js"

export const isAuthenticated = async ( req: Request, res: Response, next: NextFunction ) => {
  const authHeader = req.cookies [ "accessToken" ] || req.headers.authorization || ""
  if ( !authHeader || !authHeader.startsWith ( "Bearer " ) ) {
    res.status ( 401 ).json ( {
      status: 401,
      message: "Authorization header missing or invalid."
    } )
    return
  }

  const token = authHeader.split ( " " ) [ 1 ]

  const payload = await verifyToken ( token )

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
    }
  }

  next ( )
}