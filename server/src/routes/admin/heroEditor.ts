import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

const MAX_HEROES = 3

export interface Hero {
  id: string
  url: string
  title: string
  description: string
}

const heroesCache: Record<string, { heroes: Hero [ ]; time: number }> = { }
const TTL = 60000

export const router: FastifyPluginAsync = async app => {
  /**
   * GET /api/admin/hero-editor/:pageId
   * Fetches the hero data array for a specific page (document).
   */
  app.get ( "/:pageId", async ( req, rep ) => {
    const { pageId } = req.params as { pageId?: string }
    if ( !pageId ) {
      return rep.status ( 400 ).send ( "Missing PageID" )
    }

    const cached = heroesCache [ pageId ]
    if ( cached && Date.now ( ) - cached.time < TTL ) {
      return rep.send ( { heroes: cached.heroes } )
    }

    try {
      const doc = await getFirestore ( ).collection ( "heroes" ).doc ( pageId ).get ( )
      const data = ( doc.data ( ) as { heroes: Hero [ ] } | undefined ) ?? { heroes: [ ] }

      heroesCache [ pageId ] = {
        heroes: data.heroes,
        time: Date.now ( )
      }

      return rep.status ( 200 ).send ( data )
    } catch ( error ) {
      console.error ( "Error fetching hero data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch hero configuration." )
    }
  } )

  /**
   * POST /api/admin/hero-editor/:pageId
   * Saves (overwrites) the entire hero data array for a specific page.
   */
  app.post ( "/:pageId", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { pageId } = req.params as { pageId?: string }
    const { heroes } = req.body as { heroes?: {
      id: string
      url: string
      title: string
      description: string
    } [ ] }

    if ( !pageId ) {
      return rep.status ( 400 ).send ( "Missing PageID" )
    }

    if ( !heroes || !Array.isArray ( heroes ) ) {
      return rep.status ( 400 ).send ( "Invalid Hero Data Format" )
    }

    if ( !heroes.length ) {
      return rep.status ( 400 ).send ( "Hero data cannot be empty." )
    }

    if ( heroes.length > MAX_HEROES ) {
      return rep.status ( 400 ).send ( `Cannot save more than ${MAX_HEROES} hero entries.` )
    }

    if ( heroes.some ( ( hero: { url: string } ) => !hero.url ) ) {
      return rep.status ( 400 ).send ( "All hero entries must have a valid image URL." )
    }

    // Sanitize and validate fields (e.g., ensure URLs are valid, titles are short)
    const sanitizedHeroes = heroes.map ( ( hero: {
      id: string
      url: string
      title: string
      description: string
    } ) => ( {
      id: hero.id,
      url: String ( hero.url || "" ).trim ( ), // Ensure URL is a string
      title: String ( hero.title || "" ).substring ( 0, 100 ),
      description: String ( hero.description || "" ).substring ( 0, 500 ),
    } ) )

    try {
      const heroesCollection = getFirestore ( ).collection ( "heroes" )
      const docRef = heroesCollection.doc ( pageId )

      await docRef.set ( { heroes: sanitizedHeroes } )
      heroesCache [ pageId ] = {
        heroes: sanitizedHeroes,
        time: Date.now ( )
      }

      const shared_links = getFirestore ( ).collection ( "shared_links" )
      const snapshot = await shared_links.where ( "type", "==", "hero_editor" ).get ( )

      for ( const doc of snapshot.docs ) {
        const id = doc.id
        const expectedUrlEnding = `/api/public/s/${id}`
        const isInHeroes = sanitizedHeroes.some ( hero => {
          return hero.url.endsWith ( expectedUrlEnding )
        } )

        const events = getFirestore ( ).collection ( "events" )
        const eventsSnapshot = ( ( await events.doc ( "default" ).get ( ) ).data ( )?. [ "events" ] || [ ] ) as {
          imageUrl?: string
        } [ ]
        const isInEvents = eventsSnapshot.some ( event => {
          return event.imageUrl && event.imageUrl.endsWith ( expectedUrlEnding )
        } )

        if ( !isInHeroes && !isInEvents ) {
          await shared_links.doc ( id ).delete ( )
        }
      }

      return rep.status ( 200 ).send ( { message: `Hero data for '${pageId}' saved successfully.` } )
    } catch ( error ) {
      console.error ( "Error saving hero data", error )
      return rep.status ( 500 ).send ( "Failed to save hero configuration." )
    }
  } )

  /**
   * DELETE /api/admin/hero-editor/:pageId
   * Deletes the hero data document for a specific page.
   */
  app.delete ( "/:pageId", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { pageId } = req.params as { pageId?: string }

    if ( !pageId ) {
      return rep.status ( 400 ).send ( "Missing PageID" )
    }

    try {
      const heroesCollection = getFirestore ( ).collection ( "heroes" )
      const docRef = heroesCollection.doc ( pageId )

      await docRef.delete ( )
      delete heroesCache [ pageId ]

      return rep.status ( 200 ).send ( { message: `Hero data for '${pageId}' deleted successfully.` } )
    } catch ( error ) {
      console.error ( "Error deleting hero data:", error )
      return rep.status ( 500 ).send ( "Failed to delete hero configuration." )
    }
  } )
}