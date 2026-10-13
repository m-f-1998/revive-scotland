import { FastifyPluginAsync } from "fastify"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestore } from "../admin.js"
import {
  attachAdminUser,
  normalizeOrgAdminEmails,
  requireSuperAdmin
} from "./middleware/authz.js"
import { StripeService } from "../../services/stripe.service.js"
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

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", { preHandler: [ attachAdminUser ] }, async ( req, rep ) => {
    const admin = req.adminUser!
    const orgs = await listOrganizations ( )
    const visible = admin.role === "superadmin"
      ? orgs
      : orgs.filter ( o => userCanAccessOrganization ( admin.role, admin.organizationIds, o.id ) )

    return rep.send ( {
      organizations: visible.map ( o => ( {
        ...toPublicOrganization ( o ),
        enabled: o.enabled !== false,
        stripeConnectAccountId: o.stripeConnectAccountId || null,
        stripeConnectChargesEnabled: !!o.stripeConnectChargesEnabled,
        stripeConnectPayoutsEnabled: !!o.stripeConnectPayoutsEnabled,
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
      return rep.status ( 409 ).send ( { error: "Organization id already exists." } )
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
      platformFeePercent: typeof body [ "platformFeePercent" ] === "number" ? body [ "platformFeePercent" ] : null,
      platformFeeFixedPence: typeof body [ "platformFeeFixedPence" ] === "number" ? body [ "platformFeeFixedPence" ] : null,
      createdAt: FieldValue.serverTimestamp ( ),
      updatedAt: FieldValue.serverTimestamp ( )
    } )

    const org = await resolveOrganizationById ( id )
    return rep.status ( 201 ).send ( {
      organization: org,
      bookingUrl: partnerBookingUrl ( slug )
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
      if ( typeof body [ "platformFeePercent" ] === "number" ) {
        patch [ "platformFeePercent" ] = body [ "platformFeePercent" ]
      }
      if ( typeof body [ "platformFeeFixedPence" ] === "number" ) {
        patch [ "platformFeeFixedPence" ] = body [ "platformFeeFixedPence" ]
      }
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
      return rep.status ( 404 ).send ( { error: "Organization not found." } )
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
      return rep.status ( 404 ).send ( { error: "Organization not found." } )
    }

    const host = process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk"
    const refreshUrl = `${host.replace ( /\/$/, "" )}/admin/organizations?connect=refresh&org=${encodeURIComponent ( id )}`
    const returnUrl = `${host.replace ( /\/$/, "" )}/admin/organizations?connect=done&org=${encodeURIComponent ( id )}`

    const link = await StripeService.createConnectOnboardingLink ( {
      organizationId: id,
      refreshUrl,
      returnUrl,
      existingAccountId: org.stripeConnectAccountId
    } )

    if ( !link ) {
      return rep.status ( 500 ).send ( { error: "Stripe Connect is not configured." } )
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
