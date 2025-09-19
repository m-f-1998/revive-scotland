import type { Request, Response, NextFunction } from "express"
import { verifyToken } from "../auth.js"

export const isAuthenticated = async ( req: Request, res: Response, next: NextFunction ) => {
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

  next ( )
}