import { FastifyReply, FastifyRequest } from "fastify"
import { DecodedIdToken } from "firebase-admin/auth"
import { getAuth, getFirestore } from "../../admin.js"
import { Timestamp } from "firebase-admin/firestore"
import { isEmailAdmin, normalizeAdminEmail } from "./fileExplorer.js"
import {
  AdminRole,
  userCanAccessOrganization
} from "../../../services/organization.service.js"

declare module "fastify" {
  interface FastifyRequest {
    adminUser?: DecodedIdToken & {
      role: AdminRole
      organizationIds: string[]
    }
  }
}

export const attachAdminUser = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const authHeader = request.headers.authorization
  if ( !authHeader?.startsWith ( "Bearer " ) ) {
    reply.code ( 401 ).send ( "Unauthorized: No token provided." )
    return
  }

  const idToken = authHeader.split ( "Bearer " ) [ 1 ]!

  try {
    const decodedToken = await getAuth ( ).verifyIdToken ( idToken, true )

    if ( !decodedToken.email_verified ) {
      reply.code ( 403 ).send ( "Forbidden: Email not verified." )
      return
    }

    if ( !isEmailAdmin ( decodedToken.email ) ) {
      reply.code ( 403 ).send ( "Forbidden: User is not an administrator." )
      return
    }

    const sessionDoc = await getFirestore ( ).collection ( "users" ).doc ( decodedToken.uid ).get ( )
    const sessionExpiry = sessionDoc.data ( )?. [ "sessionExpiry" ] as Timestamp | undefined
    const expiryDate = sessionExpiry && typeof sessionExpiry.toDate === "function"
      ? sessionExpiry.toDate ( )
      : null

    if ( !expiryDate || expiryDate < new Date ( ) ) {
      reply.code ( 401 ).send ( "Unauthorized: Session has expired." )
      return
    }

    const claimsRole = decodedToken [ "role" ] as string | undefined
    const role = ( sessionDoc.data ( )?. [ "role" ] || claimsRole || "viewer" ) as AdminRole
    const sessionData = sessionDoc.data ( )
    const organizationIds = Array.isArray ( sessionData?. [ "organizationIds" ] )
      ? sessionData [ "organizationIds" ] as string[]
      : [ ]

    request.user = decodedToken
    request.adminUser = {
      ...decodedToken,
      role,
      organizationIds
    }
  } catch ( error ) {
    request.log.error ( error )
    reply.code ( 403 ).send ( "Forbidden: Invalid token." )
  }
}

/** Same as attachAdminUser — alias for routes that used checkFirebaseAuth. */
export const checkFirebaseAuth = attachAdminUser

export const requireSuperAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  if ( !request.adminUser ) {
    reply.code ( 401 ).send ( "Unauthorized." )
    return
  }
  if ( request.adminUser.role !== "superadmin" ) {
    reply.code ( 403 ).send ( "Forbidden: Superadmin required." )
    return
  }
}

export const requireOrgAccess = ( organizationId: string ) => async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  if ( !request.adminUser ) {
    reply.code ( 401 ).send ( "Unauthorized." )
    return
  }
  if ( !userCanAccessOrganization (
    request.adminUser.role,
    request.adminUser.organizationIds,
    organizationId
  ) ) {
    reply.code ( 403 ).send ( "Forbidden: No access to this organization." )
    return
  }
}

export const normalizeOrgAdminEmails = ( emails: unknown ): string[] => {
  if ( !Array.isArray ( emails ) ) return [ ]
  return [ ...new Set ( emails.map ( e => normalizeAdminEmail ( String ( e ) ) ).filter ( Boolean ) ) ]
}
