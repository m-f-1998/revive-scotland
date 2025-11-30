import { Router, Request, Response } from "express"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getFirestore } from "../admin.js" // Your existing firebase admin export
import { Readable } from "stream"

// Duplicate env setup or import from a shared config file
const R2_ACCOUNT_ID = process.env [ "R2_ACCOUNT_ID" ]
const R2_ACCESS_KEY_ID = process.env [ "R2_ACCESS_KEY_ID" ]
const R2_SECRET_ACCESS_KEY = process.env [ "R2_SECRET_ACCESS_KEY" ]
const R2_BUCKET_NAME = process.env [ "R2_BUCKET_NAME" ]
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

const s3Client = new S3Client ( {
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  }
} )

export const router = Router ( )

/**
 * PUBLIC ROUTE: /s/:id
 * This is the link users click (e.g., revivescotland.co.uk/api/public/s/abc-123)
 */
router.get ( "/s/:id", async ( req: Request, res: Response ) => {
  const shareId = req.params [ "id" ] as string

  if ( !shareId ) {
    res.status ( 400 ).send ( "Missing share ID." )
    return
  }

  try {
    const docRef = getFirestore ( ).collection ( "shared_links" ).doc ( shareId )
    const docSnap = await docRef.get ( )

    if ( !docSnap.exists ) {
      res.status ( 404 ).send ( "File not found or link has been revoked." )
      return
    }

    const data = docSnap.data ( )

    if ( data?. [ "expiresAt" ] ) {
      const now = new Date ( )
      const expiry = data [ "expiresAt" ].toDate ( ) // Firestore Timestamp conversion
      if ( now > expiry ) {
        res.status ( 410 ).send ( "This link has expired." )
        return
      }
    }

    const command = new GetObjectCommand ( {
      Bucket: R2_BUCKET_NAME,
      Key: data?. [ "key" ],
    } )
    const { Body, ContentType, ContentLength } = await s3Client.send ( command )

    res.setHeader ( "Content-Type", ContentType || "application/octet-stream" )
    if ( ContentLength ) {
      res.setHeader ( "Content-Length", ContentLength.toString ( ) )
    }

    if ( Body instanceof Readable ) {
      Body.pipe ( res )
    } else {
      res.status ( 500 ).send ( "Error retrieving file stream." )
    }
  } catch ( error ) {
    console.error ( "Public Share Error:", error )
    res.status ( 500 ).send ( "Error retrieving file." )
  }
} )