import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const R2_ACCOUNT_ID = process.env [ "R2_ACCOUNT_ID" ]
const R2_ACCESS_KEY_ID = process.env [ "R2_ACCESS_KEY_ID" ]
const R2_SECRET_ACCESS_KEY = process.env [ "R2_SECRET_ACCESS_KEY" ]
export const R2_BUCKET_NAME = process.env [ "R2_BUCKET_NAME" ]

if ( !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME ) {
  throw new Error ( "R2 configuration is missing in environment variables." )
}

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

export const s3Client = new S3Client ( {
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  }
} )

export class S3Service {
  public static async listObjects ( prefix: string ) {
    const command = new ListObjectsV2Command ( {
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
    } )
    return await s3Client.send ( command )
  }

  public static async listAllKeysUnderPrefix ( prefix: string ) {
    const keys: { key: string; size: number }[] = [ ]
    let isTruncated = true
    let continuationToken: string | undefined = undefined

    while ( isTruncated ) {
      const command: ListObjectsV2Command = new ListObjectsV2Command ( {
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken
      } )
      const data = await s3Client.send ( command );
      ( data.Contents || [ ] ).forEach ( item => {
        keys.push ( { key: item.Key!, size: item.Size || 0 } )
      } )

      isTruncated = data.IsTruncated || false
      continuationToken = data.NextContinuationToken
    }
    return keys
  }

  public static async generateUploadUrl ( key: string, contentType: string, fileSize: number, expiresInSeconds = 120 ) {
    const command = new PutObjectCommand ( {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize
    } )
    return await getSignedUrl ( s3Client, command, { expiresIn: expiresInSeconds } )
  }

  public static async createFolder ( key: string ) {
    const command = new PutObjectCommand ( {
      Bucket: R2_BUCKET_NAME,
      Key: key
    } )
    await s3Client.send ( command )
  }

  public static async deleteObject ( key: string ) {
    const command = new DeleteObjectCommand ( {
      Bucket: R2_BUCKET_NAME,
      Key: key,
    } )
    await s3Client.send ( command )
  }

  public static async copyObject ( sourceKey: string, targetKey: string ) {
    const copyCommand = new CopyObjectCommand ( {
      Bucket: R2_BUCKET_NAME,
      CopySource: `${R2_BUCKET_NAME}/${sourceKey}`,
      Key: targetKey,
    } )
    await s3Client.send ( copyCommand )
  }

  public static async getObjectSize ( key: string ): Promise<number> {
    const headData = await s3Client.send ( new HeadObjectCommand ( { Bucket: R2_BUCKET_NAME, Key: key } ) ) as { ContentLength?: number }
    return headData.ContentLength || 0
  }
}