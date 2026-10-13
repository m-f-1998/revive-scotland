import { FieldValue } from "firebase-admin/firestore"
import { getFirestore } from "../routes/admin.js"
import { normalizeAdminEmail } from "../routes/admin/middleware/fileExplorer.js"

export type AdminRole = "viewer" | "admin" | "superadmin"

export interface Organization {
  id: string
  slug: string
  name: string
  logoUrl?: string
  websiteUrl?: string
  primaryColor?: string
  accentColor?: string
  tagline?: string
  enabled?: boolean
  adminEmails?: string[]
  stripeConnectAccountId?: string
  stripeConnectChargesEnabled?: boolean
  stripeConnectPayoutsEnabled?: boolean
  platformFeePercent?: number
  platformFeeFixedPence?: number
}

export interface PublicOrganization {
  id: string
  slug: string
  name: string
  logoUrl?: string
  websiteUrl?: string
  primaryColor?: string
  accentColor?: string
  tagline?: string
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const getDefaultOrganizationId = ( ): string => {
  return ( process.env [ "ORGANIZATION_ID" ] || "revive-scotland" ).trim ( ) || "revive-scotland"
}

export const normalizeOrgSlug = ( slug: string ): string => slug.trim ( ).toLowerCase ( )

export const isValidOrgSlug = ( slug: string ): boolean => {
  return SLUG_PATTERN.test ( normalizeOrgSlug ( slug ) )
}

const docToOrganization = ( id: string, data: Record<string, unknown> ): Organization => {
  return {
    id,
    slug: String ( data [ "slug" ] || id ),
    name: String ( data [ "name" ] || id ),
    logoUrl: data [ "logoUrl" ] as string | undefined,
    websiteUrl: data [ "websiteUrl" ] as string | undefined,
    primaryColor: data [ "primaryColor" ] as string | undefined,
    accentColor: data [ "accentColor" ] as string | undefined,
    tagline: data [ "tagline" ] as string | undefined,
    enabled: data [ "enabled" ] !== false,
    adminEmails: Array.isArray ( data [ "adminEmails" ] )
      ? data [ "adminEmails" ].map ( ( e: unknown ) => normalizeAdminEmail ( String ( e ) ) )
      : [ ],
    stripeConnectAccountId: data [ "stripeConnectAccountId" ] as string | undefined,
    stripeConnectChargesEnabled: data [ "stripeConnectChargesEnabled" ] === true,
    stripeConnectPayoutsEnabled: data [ "stripeConnectPayoutsEnabled" ] === true,
    platformFeePercent: typeof data [ "platformFeePercent" ] === "number" ? data [ "platformFeePercent" ] : undefined,
    platformFeeFixedPence: typeof data [ "platformFeeFixedPence" ] === "number" ? data [ "platformFeeFixedPence" ] : undefined
  }
}

export const toPublicOrganization = ( org: Organization ): PublicOrganization => ( {
  id: org.id,
  slug: org.slug,
  name: org.name,
  logoUrl: org.logoUrl,
  websiteUrl: org.websiteUrl,
  primaryColor: org.primaryColor,
  accentColor: org.accentColor,
  tagline: org.tagline
} )

export const ensureDefaultOrganization = async ( ): Promise<Organization> => {
  const id = getDefaultOrganizationId ( )
  const db = getFirestore ( )
  const ref = db.collection ( "organizations" ).doc ( id )
  const snap = await ref.get ( )
  if ( snap.exists ) {
    return docToOrganization ( id, snap.data ( )! )
  }

  const seed = {
    slug: id,
    name: process.env [ "ORGANIZATION_NAME" ] || "Revive Scotland",
    websiteUrl: process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk",
    enabled: true,
    createdAt: FieldValue.serverTimestamp ( ),
    updatedAt: FieldValue.serverTimestamp ( )
  }
  await ref.set ( seed, { merge: true } )
  return docToOrganization ( id, {
    slug: id,
    name: seed.name,
    websiteUrl: seed.websiteUrl,
    enabled: true
  } )
}

export const resolveOrganizationBySlug = async ( slug: string ): Promise<Organization | undefined> => {
  const normalized = normalizeOrgSlug ( slug )
  if ( !normalized ) return undefined

  const db = getFirestore ( )
  const bySlug = await db.collection ( "organizations" ).where ( "slug", "==", normalized ).limit ( 1 ).get ( )
  if ( !bySlug.empty ) {
    const doc = bySlug.docs [ 0 ]!
    return docToOrganization ( doc.id, doc.data ( ) )
  }

  const byId = await db.collection ( "organizations" ).doc ( normalized ).get ( )
  if ( byId.exists ) {
    return docToOrganization ( byId.id, byId.data ( )! )
  }

  if ( normalized === getDefaultOrganizationId ( ) ) {
    return ensureDefaultOrganization ( )
  }

  return undefined
}

export const resolveOrganizationById = async ( orgId: string ): Promise<Organization | undefined> => {
  if ( !orgId ) return undefined
  const doc = await getFirestore ( ).collection ( "organizations" ).doc ( orgId ).get ( )
  if ( doc.exists ) {
    return docToOrganization ( doc.id, doc.data ( )! )
  }
  if ( orgId === getDefaultOrganizationId ( ) ) {
    return ensureDefaultOrganization ( )
  }
  return undefined
}

export const listOrganizations = async ( ): Promise<Organization [ ]> => {
  await ensureDefaultOrganization ( )
  const snap = await getFirestore ( ).collection ( "organizations" ).get ( )
  return snap.docs.map ( doc => docToOrganization ( doc.id, doc.data ( ) ) )
}

export const resolveOrganizationIdsForEmail = async (
  email: string | undefined,
  role: AdminRole
): Promise<string [ ]> => {
  if ( role === "superadmin" ) {
    const all = await listOrganizations ( )
    const ids = all.map ( o => o.id )
    if ( !ids.includes ( getDefaultOrganizationId ( ) ) ) {
      ids.unshift ( getDefaultOrganizationId ( ) )
    }
    return ids
  }

  if ( !email ) return [ getDefaultOrganizationId ( ) ]

  const normalized = normalizeAdminEmail ( email )
  const snap = await getFirestore ( ).collection ( "organizations" ).get ( )
  const matched = snap.docs
    .filter ( doc => {
      const admins = doc.data ( )?. [ "adminEmails" ]
      if ( !Array.isArray ( admins ) ) return false
      return admins.some ( ( a: unknown ) => normalizeAdminEmail ( String ( a ) ) === normalized )
    } )
    .map ( doc => doc.id )

  if ( matched.length > 0 ) return matched
  return [ getDefaultOrganizationId ( ) ]
}

export const userCanAccessOrganization = (
  role: AdminRole,
  organizationIds: string [ ] | undefined,
  organizationId: string
): boolean => {
  if ( role === "superadmin" ) return true
  const allowed = organizationIds?.length ? organizationIds : [ getDefaultOrganizationId ( ) ]
  return allowed.includes ( organizationId )
}

export const eventOrganizationId = ( event: { organizationId?: string } ): string => {
  return event.organizationId?.trim ( ) || getDefaultOrganizationId ( )
}

export const filterEventsForOrganization = <T extends { organizationId?: string }> (
  events: T [ ],
  organizationId: string
): T [ ] => {
  return events.filter ( e => eventOrganizationId ( e ) === organizationId )
}

export const computePlatformFeePence = ( amountPence: number, org: Organization ): number => {
  if ( !org.stripeConnectAccountId || amountPence <= 0 ) return 0
  const percent = org.platformFeePercent ?? Number ( process.env [ "PLATFORM_FEE_PERCENT" ] || 0 )
  const fixed = org.platformFeeFixedPence ?? Number ( process.env [ "PLATFORM_FEE_FIXED_PENCE" ] || 0 )
  const fromPercent = percent > 0 ? Math.round ( amountPence * ( percent / 100 ) ) : 0
  const fee = fromPercent + ( fixed > 0 ? fixed : 0 )
  return Math.min ( Math.max ( fee, 0 ), amountPence )
}

export const partnerBookingBasePath = ( orgSlug: string ): string => `/book/${encodeURIComponent ( orgSlug )}`

export const partnerBookingUrl = (
  orgSlug: string,
  opts?: { returnUrl?: string; embed?: boolean; eventId?: string }
): string => {
  const host = process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk"
  const base = `${host.replace ( /\/$/, "" )}${partnerBookingBasePath ( orgSlug )}`
  const params = new URLSearchParams ( )
  if ( opts?.returnUrl ) params.set ( "return", opts.returnUrl )
  if ( opts?.embed ) params.set ( "embed", "1" )
  if ( opts?.eventId ) params.set ( "eventId", opts.eventId )
  const qs = params.toString ( )
  return qs ? `${base}?${qs}` : base
}
