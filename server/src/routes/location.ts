import { Router } from "express"
import type { Request, Response } from "express"
import { google } from "googleapis"
import { config } from "dotenv"
import { resolve } from "path"
import { isDevMode } from "../server.js"
import { rateLimit } from "express-rate-limit"

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

export const router = Router ( )

router.use ( rateLimit ( {
  windowMs: 60 * 1000, // 1 minute
  max: 40, // Limit each IP to 40 requests per windowMs
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    status: 429,
    message: "Too many requests, please try again later."
  }
} ) )

router.get ( "/", async ( req: Request, res: Response ) => {
  let placeID = req.query [ "placeID" ] as string

  if ( !placeID ) {
    res.status ( 400 ).json ( { message: "Place ID is required." } )
    return
  }

  if ( placeID.startsWith ( "place/" ) ) {
    placeID = placeID.replace ( "place/", "" )
  }

  let referer = req.headers.referer || ""
  if ( isDevMode ( ) ) {
    referer = "http://localhost:3000"
  }

  try {
    const response = await fetch ( `https://places.googleapis.com/v1/places/${ placeID }?key=${ process.env [ "GOOGLE_API_KEY" ] || "" }&fields=location,formattedAddress,displayName,addressComponents`, {
      headers: {
        "Referer": referer
      }
    } )

    if ( !response.ok ) {
      console.error ( "Error fetching place data:", await response.json ( ) )
      res.status ( 500 ).json ( { message: "Internal server error." } )
      return
    }

    const data: any = await response.json ( )

    return res.json ( !data ? [ ] : Array.isArray ( data ) ? data : [ data ] )
  } catch ( error ) {
    console.error ( "Error fetching postcode data:", error )
    res.status ( 500 ).json ( { message: "Internal server error." } )
    return
  }
} )

router.get ( "/lookup", async ( req: Request, res: Response ) => {
  const location = req.query [ "location" ] as string

  if ( !location ) {
    res.status ( 400 ).json ( { message: "Location is required." } )
    return
  }

  if ( location.length < 3 ) {
    res.status ( 400 ).json ( { message: "Location must be at least 3 characters long." } )
    return
  }

  let referer = req.headers.referer || ""
  if ( isDevMode ( ) ) {
    referer = "http://localhost:3000"
  }

  const placesClient = google.places ( {
    version: "v1",
    auth: process.env [ "GOOGLE_API_KEY" ] || "",
    referrer: referer,
  } )

  try {
    const response = await placesClient.places.autocomplete ( {
      requestBody: {
        input: location,
      }
    } )

    return res.json ( response.data.suggestions?.map ( x => {
      return {
        id: x.placePrediction?.placeId,
        text: x.placePrediction?.text?.text || "",
      }
    } ) )
  } catch ( error ) {
    console.error ( "Error fetching postcode data:", error )
    res.status ( 500 ).json ( { message: "Internal server error." } )
    return
  }
} )