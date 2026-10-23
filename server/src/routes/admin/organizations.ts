import { FastifyPluginAsync } from "fastify"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestore } from "../admin.js"
import {
  attachAdminUser,
  normalizeOrgAdminEmails,
  requireSuperAdmin
} from "./middleware/authz.js"
import { StripeService } from "../../services/stripe.service.js"
import { isDevMode } from "../static.js"
import {
  getDefaultOrganizationId,
  isValidOrgSlug,
  listOrganizations,
  normalizeOrgSlug,
  partnerBookingUrl,
  resolveOrganizationById,
  toPublicOrganization,
  userCanAccessOrganization
} from "../../services/organization.service.js"

const finiteNumber = ( value: unknown ): number | null => {
  if ( typeof value === "number" && Number.isFinite ( value ) ) return value
  if ( typeof value === "string" && value.trim ( ) !== "" && Number.isFinite ( Number ( value ) ) ) {
    return Number ( value )
  }
  return null
}

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", { preHandler: [ attachAdminUser ] }, async ( req, rep ) => {
    const admin = req.adminUser!
    const orgs = await listOrganizations ( )
    const visible = admin.role === "superadmin"
      ? orgs
      : orgs.filter ( o => userCanAccessOrganization ( admin.role, admin.organizationIds, o.id ) )

    const stripeDevReady = StripeService.devUsesPlatformTestAccount ( )
    return rep.send ( {
      organizations: visible.map ( o => ( {
        ...toPublicOrganization ( o ),
        enabled: o.enabled !== false,
        stripeConnectAccountId: o.stripeConnectAccountId || null,
        stripeConnectChargesEnabled: !!o.stripeConnectChargesEnabled,
        stripeConnectPayoutsEnabled: !!o.stripeConnectPayoutsEnabled,
        stripeDevReady,
        platformFeePercent: o.platformFeePercent ?? null,
        platformFeeFixedPence: o.platformFeeFixedPence ?? null,
        adminEmails: admin.role === "superadmin" ? ( o.adminEmails || [ ] ) : undefined
      } ) )
    } )
  } )

  app.post ( "/", { preHandler: [ attachAdminUser, requireSuperAdmin ] }, async ( req, rep ) => {
    const body = req.body as Record<string, unknown>
    const id = String ( body [ "id" ] || body [ "slug" ] || "" ).trim ( )
    const slug = normalizeOrgSlug ( String ( body [ "slug" ] || id ) )
    const name = String ( body [ "name" ] || "" ).trim ( )

    if ( !id || !slug || !name ) {
      return rep.status ( 400 ).send ( { error: "id, slug, and name are required." } )
    }
    if ( !isValidOrgSlug ( slug ) ) {
      return rep.status ( 400 ).send ( { error: "Invalid slug (use lowercase letters, numbers, hyphens)." } )
    }

    const db = getFirestore ( )
    const ref = db.collection ( "organizations" ).doc ( id )
    const existing = await ref.get ( )
    if ( existing.exists ) {
      return rep.status ( 409 ).send ( { error: "An organisation with this id already exists." } )
    }

    const slugTaken = await db.collection ( "organizations" ).where ( "slug", "==", slug ).limit ( 1 ).get ( )
    if ( !slugTaken.empty ) {
      return rep.status ( 409 ).send ( { error: "Slug already in use." } )
    }

    await ref.set ( {
      slug,
      name,
      logoUrl: body [ "logoUrl" ] || null,
      websiteUrl: body [ "websiteUrl" ] || null,
      primaryColor: body [ "primaryColor" ] || null,
      accentColor: body [ "accentColor" ] || null,
      tagline: body [ "tagline" ] || null,
      enabled: body [ "enabled" ] !== false,
      adminEmails: normalizeOrgAdminEmails ( body [ "adminEmails" ] ),
      platformFeePercent: finiteNumber ( body [ "platformFeePercent" ] ),
      platformFeeFixedPence: finiteNumber ( body [ "platformFeeFixedPence" ] ),
      createdAt: FieldValue.serverTimestamp ( ),
      updatedAt: FieldValue.serverTimestamp ( )
    } )

    const host = isDevMode ( )
      ? "http://localhost:4200"
      : ( process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk" )
    const base = host.replace ( /\/$/, "" )
    let onboardingUrl: string | null = null
    try {
      const link = await StripeService.createConnectOnboardingLink ( {
        organizationId: id,
        refreshUrl: `${base}/admin/organizations?connect=refresh&org=${encodeURIComponent ( id )}`,
        returnUrl: `${base}/admin/organizations?connect=done&org=${encodeURIComponent ( id )}`
      } )
      if ( link?.accountId ) {
        await ref.set ( {
          stripeConnectAccountId: link.accountId,
          updatedAt: FieldValue.serverTimestamp ( )
        }, { merge: true } )
        onboardingUrl = link.url
      }
    } catch ( error ) {
      console.warn ( "Organisation saved without a Stripe account:", error )
    }

    const org = await resolveOrganizationById ( id )
    return rep.status ( 201 ).send ( {
      organization: org,
      bookingUrl: partnerBookingUrl ( slug ),
      onboardingUrl
    } )
  } )

  app.patch ( "/:id", { preHandler: [ attachAdminUser ] }, async ( req, rep ) => {
    const { id } = req.params as { id: string }
    const admin = req.adminUser!
    if ( !userCanAccessOrganization ( admin.role, admin.organizationIds, id ) ) {
      return rep.status ( 403 ).send ( { error: "Forbidden." } )
    }

    const body = req.body as Record<string, unknown>
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp ( ) }

    if ( body [ "name" ] != null ) patch [ "name" ] = String ( body [ "name" ] )
    if ( body [ "logoUrl" ] != null ) patch [ "logoUrl" ] = body [ "logoUrl" ]
    if ( body [ "websiteUrl" ] != null ) patch [ "websiteUrl" ] = body [ "websiteUrl" ]
    if ( body [ "primaryColor" ] != null ) patch [ "primaryColor" ] = body [ "primaryColor" ]
    if ( body [ "accentColor" ] != null ) patch [ "accentColor" ] = body [ "accentColor" ]
    if ( body [ "tagline" ] != null ) patch [ "tagline" ] = body [ "tagline" ]
    if ( body [ "enabled" ] != null ) patch [ "enabled" ] = !!body [ "enabled" ]

    if ( admin.role === "superadmin" ) {
      if ( body [ "adminEmails" ] != null ) {
        patch [ "adminEmails" ] = normalizeOrgAdminEmails ( body [ "adminEmails" ] )
      }
      const percent = finiteNumber ( body [ "platformFeePercent" ] )
      const fixed = finiteNumber ( body [ "platformFeeFixedPence" ] )
      if ( percent != null ) patch [ "platformFeePercent" ] = percent
      if ( fixed != null ) patch [ "platformFeeFixedPence" ] = fixed
    }

    if ( body [ "slug" ] != null ) {
      const slug = normalizeOrgSlug ( String ( body [ "slug" ] ) )
      if ( !isValidOrgSlug ( slug ) ) {
        return rep.status ( 400 ).send ( { error: "Invalid slug." } )
      }
      patch [ "slug" ] = slug
    }

    const ref = getFirestore ( ).collection ( "organizations" ).doc ( id )
    if ( !( await ref.get ( ) ).exists && id !== getDefaultOrganizationId ( ) ) {
      return rep.status ( 404 ).send ( { error: "Organisation not found." } )
    }

    await ref.set ( patch, { merge: true } )
    const org = await resolveOrganizationById ( id )
    return rep.send ( {
      organization: org,
      bookingUrl: org ? partnerBookingUrl ( org.slug ) : null
    } )
  } )

  app.post ( "/:id/connect/onboarding", { preHandler: [ attachAdminUser, requireSuperAdmin ] }, async ( req, rep ) => {
    const { id } = req.params as { id: string }
    const org = await resolveOrganizationById ( id )
    if ( !org ) {
      return rep.status ( 404 ).send ( { error: "Organisation not found." } )
    }

    const host = isDevMode ( )
      ? "http://localhost:4200"
      : ( process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk" )
    const refreshUrl = `${host.replace ( /\/$/, "" )}/admin/organizations?connect=refresh&org=${encodeURIComponent ( id )}`
    const returnUrl = `${host.replace ( /\/$/, "" )}/admin/organizations?connect=done&org=${encodeURIComponent ( id )}`

    let link: { url: string; accountId: string } | undefined
    try {
      link = await StripeService.createConnectOnboardingLink ( {
        organizationId: id,
        refreshUrl,
        returnUrl,
        existingAccountId: org.stripeConnectAccountId
      } )
    } catch ( error ) {
      const message = error instanceof Error ? error.message : "Could not start payout setup."
      return rep.status ( 400 ).send ( { error: message } )
    }

    if ( !link ) {
      return rep.status ( 500 ).send ( { error: "Stripe is not configured." } )
    }

    if ( link.accountId && link.accountId !== org.stripeConnectAccountId ) {
      await getFirestore ( ).collection ( "organizations" ).doc ( id ).set ( {
        stripeConnectAccountId: link.accountId,
        updatedAt: FieldValue.serverTimestamp ( )
      }, { merge: true } )
    }

    return rep.send ( { url: link.url, accountId: link.accountId } )
  } )

  app.post ( "/:id/connect/sync", { preHandler: [ attachAdminUser ] }, async ( req, rep ) => {
    const { id } = req.params as { id: string }
    const admin = req.adminUser!
    if ( !userCanAccessOrganization ( admin.role, admin.organizationIds, id ) ) {
      return rep.status ( 403 ).send ( { error: "Forbidden." } )
    }

    const org = await resolveOrganizationById ( id )
    if ( !org?.stripeConnectAccountId ) {
      return rep.status ( 400 ).send ( { error: "No Connect account linked." } )
    }

    const status = await StripeService.retrieveConnectAccountStatus ( org.stripeConnectAccountId )
    if ( !status ) {
      return rep.status ( 500 ).send ( { error: "Could not retrieve Connect account." } )
    }

    await getFirestore ( ).collection ( "organizations" ).doc ( id ).set ( {
      stripeConnectChargesEnabled: status.chargesEnabled,
      stripeConnectPayoutsEnabled: status.payoutsEnabled,
      updatedAt: FieldValue.serverTimestamp ( )
    }, { merge: true } )

    return rep.send ( status )
  } )
}
