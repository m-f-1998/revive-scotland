import { FastifyPluginAsync } from "fastify"
import {
  normalizeOrgSlug,
  resolveOrganizationBySlug,
  toPublicOrganization
} from "../services/organization.service.js"

export const router: FastifyPluginAsync = async app => {
  app.get ( "/:slug/public", async ( req, rep ) => {
    const { slug } = req.params as { slug: string }
    const org = await resolveOrganizationBySlug ( normalizeOrgSlug ( slug ) )
    if ( !org || org.enabled === false ) {
      return rep.status ( 404 ).send ( { error: "Organization not found." } )
    }
    return rep.send ( { organization: toPublicOrganization ( org ) } )
  } )
}
