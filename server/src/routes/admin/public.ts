import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getFirestore } from "../admin.js" // Your existing firebase admin export
import { Readable } from "stream"
import { FastifyPluginAsync } from "fastify"

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

export const router: FastifyPluginAsync = async app => {
  /**
   * PUBLIC ROUTE: /s/:id
   * This is the link users click (e.g., revivescotland.co.uk/api/public/s/abc-123)
   */
  app.get ( "/s/:id", async ( req, rep ) => {
    const { id } = req.params as { id?: string }

    if ( !id ) {
      return rep.status ( 400 ).send ( "Missing share ID." )
    }

    try {
      const docRef = getFirestore ( ).collection ( "shared_links" ).doc ( id )
      const docSnap = await docRef.get ( )

      if ( !docSnap.exists ) {
        return rep.status ( 404 ).send ( "File not found or link has been revoked." )
      }

      const data = docSnap.data ( )

      if ( data?. [ "expiresAt" ] ) {
        const now = new Date ( )
        const expiry = data [ "expiresAt" ].toDate ( ) // Firestore Timestamp conversion
        if ( now > expiry ) {
          return rep.status ( 410 ).send ( "This link has expired." )
        }
      }

      const command = new GetObjectCommand ( {
        Bucket: R2_BUCKET_NAME,
        Key: data?. [ "key" ],
      } )
      const { Body, ContentType, ContentLength } = await s3Client.send ( command )

      rep.header ( "content-type", ContentType || "application/octet-stream" )
      if ( ContentLength ) {
        rep.header ( "content-length", ContentLength.toString ( ) )
      }

      rep.type ( ContentType || "application/octet-stream" )
      if ( Body instanceof Readable ) {
        return rep.send ( Body )
      } else {
        return rep.status ( 500 ).send ( "Error retrieving file stream." )
      }
    } catch ( error ) {
      console.error ( "Public Share Error:", error )
      return rep.status ( 500 ).send ( "Error retrieving file." )
    }
  } )
}