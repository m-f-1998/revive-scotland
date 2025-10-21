import type { Request, Response } from "express"
import { Router } from "express"

import { rateLimit } from "express-rate-limit"
import { pool } from "../db.js"
import { requireAuth } from "../middleware/requireAuth.js"

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

router.get ( "/", async ( _req: Request, res: Response ) => {
  try {
    const client = await pool!.query ( 'SELECT "id", "title", "description", "start", "end", "longitude", "latitude", "showcase_image", "donation_requested", "donation_amount", "payment_required", "payment_amount", "location_name" FROM events WHERE "end" > NOW()' )
    const results = [ ]
    for ( const row of client.rows ) {
      const lng = row?.longitude
      const lat = row?.latitude
      if ( lng && lat ) {
        const params = new URLSearchParams ( {
          lat: lat.toString ( ),
          lon: lng.toString ( ),
          format: "json", // Response format (JSON)
          addressdetails: "1", // Include address details
        } )
        const response = await fetch ( `https://nominatim.openstreetmap.org/reverse?${params.toString ( )}` )
        const json: any = await response.json ( )

        if ( json?.address ) {
          results.push ( {
            ...row,
            address: json.address
          } )
          continue
        }
      }

      results.push ( {
        ...row,
        address: null
      } )
    }
    res.json ( results )
  } catch ( error ) {
    console.error ( "Error while fetching events:", error )
    res.status ( 500 ).json ( {
      status: 500,
      message: "Internal server error."
    } )
    return
  }
} )

router.post ( "/add", requireAuth, async ( req: Request, res: Response ) => {
  const title = req.body?.title
  const description = req.body?.description
  const when = req.body?.when
  const longitude = req.body?.longitude
  const latitude = req.body?.latitude
  const showcase_image = req.body?.showcase_image
  const donation_requested = req.body?.donation_requested
  const donation_amount = req.body?.donation_amount
  const payment_required = req.body?.payment_required
  const payment_amount = req.body?.payment_amount

  if ( !title ) {
    res.json ( {
      status: 500,
      message: "Title Required"
    } )
    return
  }

  // Title validation
  if ( typeof title !== "string" || title.trim ().length === 0 ) {
    res.status ( 400 ).json ( { status: 400, message: "Title must be a non-empty string." } )
    return
  }

  // Description validation
  if ( description !== undefined && typeof description !== "string" ) {
    res.status ( 400 ).json ( { status: 400, message: "Description must be a string." } )
    return
  }

  // Date validation
  if ( when !== undefined && isNaN ( Date.parse ( when ) ) ) {
    res.status ( 400 ).json ( { status: 400, message: "Invalid date format for 'when'." } )
    return
  }

  // Longitude validation
  if ( longitude !== undefined && ( typeof longitude !== "number" || longitude < -180 || longitude > 180 ) ) {
    res.status ( 400 ).json ( { status: 400, message: "Longitude must be a number between -180 and 180." } )
    return
  }

  // Latitude validation
  if ( latitude !== undefined && ( typeof latitude !== "number" || latitude < -90 || latitude > 90 ) ) {
    res.status ( 400 ).json ( { status: 400, message: "Latitude must be a number between -90 and 90." } )
    return
  }

  // Showcase image validation
  if ( showcase_image !== undefined && ( typeof showcase_image !== "string" || showcase_image.length > 2048 ) ) {
    res.status ( 400 ).json ( { status: 400, message: "Showcase image must be a string with max length 2048." } )
    return
  }

  // Donation requested validation
  if ( donation_requested !== undefined && donation_requested !== 0 && donation_requested !== 1 ) {
    res.status ( 400 ).json ( { status: 400, message: "Donation requested must be 0 or 1." } )
    return
  }

  // Donation amount validation
  if ( donation_amount !== undefined && ( typeof donation_amount !== "number" || donation_amount < 0 ) ) {
    res.status ( 400 ).json ( { status: 400, message: "Donation amount must be a non-negative number." } )
    return
  }

  // Payment required validation
  if ( payment_required !== undefined && payment_required !== 0 && payment_required !== 1 ) {
    res.status ( 400 ).json ( { status: 400, message: "Payment required must be 0 or 1." } )
    return
  }

  // Payment amount validation
  if ( payment_amount !== undefined && ( typeof payment_amount !== "number" || payment_amount < 0 ) ) {
    res.status ( 400 ).json ( { status: 400, message: "Payment amount must be a non-negative number." } )
    return
  }

  try {
    await pool!.query (
      `INSERT INTO events (title, description, when, longitude, latitude, showcase_image, donation_requested, donation_amount, payment_required, payment_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        title,
        description ?? null,
        when ?? null,
        longitude ?? null,
        latitude ?? null,
        showcase_image ?? null,
        donation_requested === 1,
        donation_amount ?? null,
        payment_required === 1,
        payment_amount ?? null
      ]
    )
    res.status ( 201 ).json ( { success: true } )
  } catch ( error ) {
    console.error ( "Error while adding an event:", error )
    res.status ( 500 ).json ( {
      status: 500,
      message: "Internal server error."
    } )
  }
} )

router.post ( "/edit", requireAuth, async ( req: Request, res: Response ) => {
  const id = req.body?.id
  const title = req.body?.title
  const description = req.body?.description
  const when = req.body?.when
  const longitude = req.body?.longitude
  const latitude = req.body?.latitude
  const showcase_image = req.body?.showcase_image
  const donation_requested = req.body?.donation_requested
  const donation_amount = req.body?.donation_amount
  const payment_required = req.body?.payment_required
  const payment_amount = req.body?.payment_amount

  if ( !id ) {
    res.json ( {
      status: 500,
      message: "No ID Provided"
    } )
    return
  }

  // The values may not be provided, so we need to update only the data that is provided
  const fieldsToUpdate: string [ ] = [ ]
  const values: any [ ] = [ ]
  let paramIndex = 1

  // Title validation
  if ( title !== undefined ) {
    if ( typeof title !== "string" || title.trim ().length === 0 ) {
      res.status ( 400 ).json ( { status: 400, message: "Title must be a non-empty string." } )
      return
    }
    fieldsToUpdate.push ( `title=$${paramIndex++}` )
    values.push ( title.trim () )
  }

  // Description validation
  if ( description !== undefined ) {
    if ( typeof description !== "string" ) {
      res.status ( 400 ).json ( { status: 400, message: "Description must be a string." } )
      return
    }
    fieldsToUpdate.push ( `description=$${paramIndex++}` )
    values.push ( description )
  }

  // Date validation
  if ( when !== undefined ) {
    if ( isNaN ( Date.parse ( when ) ) ) {
      res.status ( 400 ).json ( { status: 400, message: "Invalid date format for 'when'." } )
      return
    }
    fieldsToUpdate.push ( `when=$${paramIndex++}` )
    values.push ( when )
  }

  // Longitude validation
  if ( longitude !== undefined ) {
    if ( typeof longitude !== "number" || longitude < -180 || longitude > 180 ) {
      res.status ( 400 ).json ( { status: 400, message: "Longitude must be a number between -180 and 180." } )
      return
    }
    fieldsToUpdate.push ( `longitude=$${paramIndex++}` )
    values.push ( longitude )
  }

  // Latitude validation
  if ( latitude !== undefined ) {
    if ( typeof latitude !== "number" || latitude < -90 || latitude > 90 ) {
      res.status ( 400 ).json ( { status: 400, message: "Latitude must be a number between -90 and 90." } )
      return
    }
    fieldsToUpdate.push ( `latitude=$${paramIndex++}` )
    values.push ( latitude )
  }

  // Showcase image validation
  if ( showcase_image !== undefined ) {
    if ( typeof showcase_image !== "string" || showcase_image.length > 2048 ) {
      res.status ( 400 ).json ( { status: 400, message: "Showcase image must be a string with max length 2048." } )
      return
    }
    fieldsToUpdate.push ( `showcase_image=$${paramIndex++}` )
    values.push ( showcase_image )
  }

  // Donation requested validation
  if ( donation_requested !== undefined ) {
    if ( donation_requested !== 0 && donation_requested !== 1 ) {
      res.status ( 400 ).json ( { status: 400, message: "Donation requested must be 0 or 1." } )
      return
    }
    fieldsToUpdate.push ( `donation_requested=$${paramIndex++}` )
    values.push ( donation_requested === 1 )
  }

  // Donation amount validation
  if ( donation_amount !== undefined ) {
    if ( typeof donation_amount !== "number" || donation_amount < 0 ) {
      res.status ( 400 ).json ( { status: 400, message: "Donation amount must be a non-negative number." } )
      return
    }
    fieldsToUpdate.push ( `donation_amount=$${paramIndex++}` )
    values.push ( donation_amount )
  }

  // Payment required validation
  if ( payment_required !== undefined ) {
    if ( payment_required !== 0 && payment_required !== 1 ) {
      res.status ( 400 ).json ( { status: 400, message: "Payment required must be 0 or 1." } )
      return
    }
    fieldsToUpdate.push ( `payment_required=$${paramIndex++}` )
    values.push ( payment_required === 1 )
  }

  // Payment amount validation
  if ( payment_amount !== undefined ) {
    if ( typeof payment_amount !== "number" || payment_amount < 0 ) {
      res.status ( 400 ).json ( { status: 400, message: "Payment amount must be a non-negative number." } )
      return
    }
    fieldsToUpdate.push ( `payment_amount=$${paramIndex++}` )
    values.push ( payment_amount )
  }

  if ( fieldsToUpdate.length === 0 ) {
    res.json ( {
      status: 400,
      message: "No fields to update."
    } )
    return
  }

  values.push ( id ) // The ID is always the last parameter
  const query = `UPDATE events SET ${fieldsToUpdate.join ( ", " )} WHERE id=$${paramIndex}`

  try {
    await pool!.query ( query, values )
    res.status ( 201 ).json ( { success: true } )
  } catch ( error ) {
    console.error ( "Error while editing an event:", error )
    res.status ( 500 ).json ( {
      status: 500,
      message: "Internal server error."
    } )
  }
} )

router.post ( "/delete", requireAuth, async ( req: Request, res: Response ) => {
  const id = req.body?.id

  if ( !id ) {
    res.json ( {
      status: 500,
      message: "No ID Provided"
    } )
    return
  }

  try {
    await pool!.query (
      "DELETE FROM events WHERE id=$1",
      [ id ]
    )
    res.status ( 201 ).json ( { success: true } )
  } catch ( error ) {
    console.error ( "Error while deleting an event:", error )
    res.status ( 500 ).json ( {
      status: 500,
      message: "Internal server error."
    } )
  }
} )
