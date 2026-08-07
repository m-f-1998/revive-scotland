import { DecodedIdToken } from "firebase-admin/auth"
import { Timestamp } from "firebase-admin/firestore"
import { getAuth, getFirestore } from "../../../routes/admin.js"
import { FastifyReply, FastifyRequest } from "fastify"

declare module "fastify" {
  interface FastifyRequest {
    user?: DecodedIdToken & {
      s3Path?: string
    }
  }
}

/** Reject path traversal and normalize S3 object keys. */
export const normalizeS3Key = ( key: string ): string | null => {
  if ( !key || typeof key !== "string" ) return null
  if ( key.includes ( "\\" ) || key.startsWith ( "/" ) ) return null
  const parts = key.split ( "/" ).filter ( p => p.length > 0 && p !== "." )
  if ( parts.length === 0 || parts.some ( p => p === ".." ) ) return null
  return parts.join ( "/" )
}

/** Admin emails from env only — SUPERADMIN_EMAIL, ADMIN_EMAIL, ADMIN_EMAILS (comma-separated). */
export const getAdminEmails = ( ): string [ ] => {
  const emails: string [ ] = [ ]
  const single = [ process.env [ "SUPERADMIN_EMAIL" ], process.env [ "ADMIN_EMAIL" ] ]
  for ( const e of single ) {
    if ( e?.trim ( ) ) emails.push ( e.trim ( ).toLowerCase ( ) )
  }
  const list = process.env [ "ADMIN_EMAILS" ]
  if ( list ) {
    for ( const e of list.split ( "," ) ) {
      const trimmed = e.trim ( ).toLowerCase ( )
      if ( trimmed ) emails.push ( trimmed )
    }
  }
  return [ ...new Set ( emails ) ]
}

export const isEmailAdmin = ( email: string | undefined | null ): boolean => {
  if ( !email ) return false
  return getAdminEmails ( ).includes ( email.toLowerCase ( ) )
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
    // checkRevoked: true so /logout (revokeRefreshTokens) takes effect immediately
    const decodedToken = await getAuth ( ).verifyIdToken ( idToken, true )

    if ( !decodedToken.email_verified ) {
      return reply.code ( 403 ).send ( "Forbidden: Email not verified." )
    }

    if ( !isEmailAdmin ( decodedToken.email ) ) {
      return reply.code ( 403 ).send ( "Forbidden: User is not an administrator." )
    }

    const sessionDoc = await getFirestore ( ).collection ( "users" ).doc ( decodedToken.uid ).get ( )
    const sessionExpiry = sessionDoc.data ( )?. [ "sessionExpiry" ] as Timestamp | undefined
    const expiryDate = sessionExpiry && typeof sessionExpiry.toDate === "function"
      ? sessionExpiry.toDate ( )
      : null

    if ( !expiryDate || expiryDate < new Date ( ) ) {
      return reply.code ( 401 ).send ( "Unauthorized: Session has expired." )
    }

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

  const body = request.body as { key?: string; oldKey?: string; newKey?: string } | undefined
  const query = request.query as { key?: string; path?: string } | undefined
  const relativePath = query?.path
  const prefix = request.user.s3Path

  const owned = ( raw: string | undefined ): string | undefined | null => {
    if ( raw == null || raw === "" ) return undefined
    const normalized = normalizeS3Key ( raw )
    if ( !normalized || !normalized.startsWith ( prefix ) ) return null
    return normalized
  }

  const nBodyKey = owned ( body?.key )
  const nQueryKey = owned ( query?.key )
  const nOldKey = owned ( body?.oldKey )
  const nNewKey = owned ( body?.newKey )

  if ( nBodyKey === null || nQueryKey === null || nOldKey === null || nNewKey === null ) {
    return reply.code ( 403 ).send ( "Forbidden: Access denied to this resource." )
  }

  if ( body && nBodyKey !== undefined ) body.key = nBodyKey
  if ( query && nQueryKey !== undefined ) query.key = nQueryKey
  if ( body && nOldKey !== undefined ) body.oldKey = nOldKey
  if ( body && nNewKey !== undefined ) body.newKey = nNewKey

  if (
    relativePath &&
    ( typeof relativePath !== "string" || relativePath.includes ( ".." ) )
  ) {
    return reply.code ( 400 ).send ( "Invalid path provided." )
  }
}
