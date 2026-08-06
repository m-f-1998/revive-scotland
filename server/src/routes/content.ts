import { FastifyPluginAsync } from "fastify"
import { router as siteContentRouter } from "./admin/siteContent.js"
import { router as ourStoryRouter } from "./admin/ourStory.js"
import { router as contactDetailsRouter } from "./admin/contactDetails.js"
import { router as heroEditorRouter } from "./admin/heroEditor.js"
import { router as prayersRouter } from "./admin/prayers.js"
import { router as reflectionsRouter } from "./admin/reflections.js"

/**
 * Public read aliases for CMS content. Writes remain on /api/admin/* with auth.
 * Mounting the same routers here exposes GETs at /api/content/* for the public site.
 */
export const router: FastifyPluginAsync = async app => {
  await app.register ( siteContentRouter, { prefix: "/site-content" } )
  await app.register ( ourStoryRouter, { prefix: "/our-story" } )
  await app.register ( contactDetailsRouter, { prefix: "/contact-details" } )
  await app.register ( heroEditorRouter, { prefix: "/hero-editor" } )
  await app.register ( prayersRouter, { prefix: "/prayers" } )
  await app.register ( reflectionsRouter, { prefix: "/reflections" } )
}
