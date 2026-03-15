import { auth } from "firebase-admin"
import { getAuth } from "../../../routes/admin.js"
import { FastifyReply, FastifyRequest } from "fastify"

declare module "fastify" {
  interface FastifyRequest {
    user?: auth.DecodedIdToken & {
      s3Path?: string
    }
  }
}

export const checkFirebaseAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization

  if ( !authHeader?.startsWith ( "Bearer " ) ) {
    return reply.code ( 401 ).send ( "Unauthorized: No token provided." )
  }

  const idToken = authHeader.split ( "Bearer " ) [ 1 ]

  try {
    const decodedToken = await getAuth ( ).verifyIdToken ( idToken )

    request.user = decodedToken
  } catch ( error ) {
    request.log.error ( error )
    return reply.code ( 403 ).send ( "Forbidden: Invalid token." )
  }
}

// Middleware to add the user's root S3 path
export const addUserPath = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if ( !request.user ) {
    return reply.code ( 401 ).send ( "Unauthorized: User not authenticated." )
  }

  request.user.s3Path = `users/${request.user.uid}/`
}

// Security check to ensure a user isn't trying to access other folders
export const validateS3Key = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if ( !request.user?.s3Path ) {
    return reply.code ( 401 ).send ( "Unauthorized: User not authenticated." )
  }

  console.log ( `Validating S3 key for user ${request.user.uid} with path prefix ${request.user.s3Path}` )

  const body = request.body as { key?: string; oldKey?: string; newKey?: string } | undefined
  const query = request.query as { key?: string; path?: string } | undefined

  const { key: bodyKey, oldKey, newKey } = body ?? {}
  const { key: queryKey, path: relativePath } = query ?? {}

  const key = bodyKey || queryKey

  if ( key && !key.startsWith ( request.user.s3Path ) ) {
    return reply.code ( 403 ).send ( "Forbidden: Access denied to this resource." )
  }

  if ( oldKey && !oldKey.startsWith ( request.user.s3Path ) ) {
    return reply.code ( 403 ).send ( "Forbidden: Access denied to source resource." )
  }

  if ( newKey && !newKey.startsWith ( request.user.s3Path ) ) {
    return reply.code ( 403 ).send ( "Forbidden: Access denied to target resource." )
  }

  if (
    relativePath &&
    ( typeof relativePath !== "string" || relativePath.includes ( ".." ) )
  ) {
    return reply.code ( 400 ).send ( "Invalid path provided." )
  }
}