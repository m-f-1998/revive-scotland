import type { Request, Response } from "express"
import { Router } from "express"

import { rateLimit } from "express-rate-limit"
import { pool } from "../db.js"

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

router.get ( "/", async ( req: Request, res: Response ) => {
  try {
    const location = req.query [ "location" ] as string | undefined
    if ( location ) {
      const client = await pool!.query ( 'SELECT "id", "filename", "title", "description", "location" FROM headers WHERE location = $1', [ location ] )
      res.json ( client.rows )
      return
    }

    res.json ( [ ] )
  } catch ( error ) {
    console.error ( "Error while fetching headers:", error )
    res.status ( 500 ).json ( {
      status: 500,
      error: "Internal server error."
    } )
    return
  }
} )