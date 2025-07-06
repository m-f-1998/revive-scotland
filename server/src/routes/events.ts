import { Router } from "express"
import type { Request, Response } from "express"
import { rateLimit } from "express-rate-limit"
import { config } from "dotenv"
import { resolve } from "path"

export const router = Router ( )

const envPath = resolve ( process.cwd ( ), ".env" )
config ( { path: envPath, quiet: true } )

router.use ( "/api/events", rateLimit ( { // limit each IP to 5 requests per hour
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
} ) )

const cache = new Map<string, any> ( )

router.get ( "/api/events", async ( _req: Request, res: Response ) => {
  try {
    if ( !process.env [ "EVENTBRITE_OAUTH_TOKEN" ] ) {
      res.status ( 500 ).json ( { message: "Eventbrite OAuth token not configured." } )
      return
    }

    if ( cache.has ( "userEvents" ) ) {
      res.json ( cache.get ( "userEvents" ).events )
      return
    }

    const organizations = await fetch ( "https://www.eventbriteapi.com/v3/users/me/organizations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env [ "EVENTBRITE_OAUTH_TOKEN" ]}`
      }
    } )

    if ( !organizations.ok ) {
      console.error ( "Error Fetching Organizations" )
      throw new Error ( await organizations.text ( ) )
    }

    const userOrganizations: any = await organizations.json ( )

    if ( !userOrganizations || !userOrganizations.organizations || userOrganizations.organizations.length === 0 ) {
      res.status ( 404 ).json ( { message: "No organizations found." } )
      return
    }

    const organizationId = userOrganizations.organizations [ 0 ].id
    const url = `https://www.eventbriteapi.com/v3/organizations/${organizationId}/events?status=live&expand=venue,ticket_classes,refund_policy`

    const events = await fetch ( url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env [ "EVENTBRITE_OAUTH_TOKEN" ]}`
      }
    } )

    if ( !events.ok ) {
      console.error ( "Error Fetching Events" )
      throw new Error ( await events.text ( ) )
    }

    const userEvents: any = await events.json ( )

    cache.set ( "userEvents", userEvents )
    setTimeout ( ( ) => {
      cache.delete ( "userEvents" )
    }, 60 * 60 * 1000 ) // Cache for 1 hour

    res.json ( userEvents.events )
  } catch ( err: any ) {
    console.error ( "Eventbrite API error:", err )
    res.status ( 500 ).json ( { message: "Eventbrite API error." } )
  }
} )
