import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getFirestore } from "../admin.js" // Your existing firebase admin export
// import { Readable } from "stream"
import { FastifyPluginAsync } from "fastify"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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

interface CachedShare {
  data?: FirebaseFirestore.DocumentData
  expiresAt: number // timestamp in ms
}

const shareCache = new Map<string, CachedShare> ()

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
      let data
      const cached = shareCache.get ( id )
      if ( cached && Date.now ( ) < cached.expiresAt ) {
        data = cached.data
      } else {
        shareCache.delete ( id )
        const snap = await docRef.get ( )
        if ( !snap.exists ) {
          return rep.status ( 404 ).send ( "File not found or link has been revoked." )
        }
        data = snap.data ( )
      }

      if ( data?. [ "expiresAt" ] ) {
        const now = new Date ( )
        const expiry = data [ "expiresAt" ].toDate ( ) // Firestore Timestamp conversion
        if ( now > expiry ) {
          shareCache.delete ( id )
          await docRef.delete ( )
          return rep.status ( 410 ).send ( "This link has expired." )
        }
      }

      if ( !data?. [ "key" ] ) {
        return rep.status ( 500 ).send ( "Invalid share record." )
      }

      const command = new GetObjectCommand ( {
        Bucket: R2_BUCKET_NAME,
        Key: data?. [ "key" ],
      } )

      shareCache.set ( id, { data, expiresAt: Date.now ( ) + 60 * 1000 } ) // 1 min cache

      const signedUrl = await getSignedUrl ( s3Client, command, {
        expiresIn: 60 * 5 // 5 minutes
      } )

      return rep.redirect ( signedUrl )
    } catch ( error ) {
      console.error ( "Public Share Error:", error )
      return rep.status ( 500 ).send ( "Error retrieving file." )
    }
  } )
}