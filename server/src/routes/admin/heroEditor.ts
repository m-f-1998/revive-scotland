import { Router, Request, Response } from "express"
import { rateLimit } from "express-rate-limit"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

export const router = Router ( )

const MAX_HEROES = 3

router.use ( rateLimit ( {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  keyGenerator: ( req: Request ) => {
    return req.user ? req.user.uid : ( req?.ip || "" )
  }
} ) )

/**
 * GET /api/admin/hero-editor/:pageId
 * Fetches the hero data array for a specific page (document).
 */
router.get ( "/:pageId", async ( req: Request, res: Response ) => {
  const pageID = req.params [ "pageId" ] as string

  if ( !pageID ) {
    return res.status ( 400 ).json ( "Missing PageID" )
  }

  try {
    const heroesCollection = getFirestore ( ).collection ( "heroes" )
    const docRef = heroesCollection.doc ( pageID )
    const doc = await docRef.get ( )

    if ( !doc.exists ) {
      return res.json ( { heroes: [ ] } )
    }

    return res.json ( doc.data ( ) )
  } catch ( error ) {
    console.error ( `Error fetching hero data for ${pageID}:`, error )
    return res.status ( 500 ).send ( "Failed to fetch hero configuration." )
  }
} )

/**
 * POST /api/admin/hero-editor/:pageId
 * Saves (overwrites) the entire hero data array for a specific page.
 */
router.post ( "/:pageId", checkFirebaseAuth, async ( req: Request, res: Response ) => {
  const pageID = req.params [ "pageId" ] as string
  const heroData = req.body

  if ( !pageID ) {
    return res.status ( 400 ).json ( "Missing PageID" )
  }

  if ( !heroData || !Array.isArray ( heroData.heroes ) ) {
    return res.status ( 400 ).json ( "Invalid Hero Data Format" )
  }

  if ( !heroData.heroes.length ) {
    return res.status ( 400 ).send ( "Hero data cannot be empty." )
  }

  if ( heroData.heroes.length > MAX_HEROES ) {
    return res.status ( 400 ).send ( `Cannot save more than ${MAX_HEROES} hero entries.` )
  }

  if ( heroData.heroes.some ( ( hero: { url: string } ) => !hero.url ) ) {
    return res.status ( 400 ).send ( "All hero entries must have a valid image URL." )
  }

  // Sanitize and validate fields (e.g., ensure URLs are valid, titles are short)
  const sanitizedHeroes = heroData.heroes.map ( ( hero: {
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
    const docRef = heroesCollection.doc ( pageID )

    // Save the entire object, overwriting previous data
    await docRef.set ( { heroes: sanitizedHeroes } )

    return res.status ( 200 ).send ( { message: `Hero data for '${pageID}' saved successfully.` } )
  } catch ( error ) {
    console.error ( `Error saving hero data for ${pageID}:`, error )
    return res.status ( 500 ).send ( "Failed to save hero configuration." )
  }
} )

/**
 * DELETE /api/admin/hero-editor/:pageId
 * Deletes the hero data document for a specific page.
 */
router.delete ( "/:pageId", checkFirebaseAuth, async ( req: Request, res: Response ) => {
  const pageID = req.params [ "pageId" ] as string

  if ( !pageID ) {
    return res.status ( 400 ).json ( "Missing PageID" )
  }

  try {
    const heroesCollection = getFirestore ( ).collection ( "heroes" )
    const docRef = heroesCollection.doc ( pageID )

    await docRef.delete ( )

    return res.status ( 200 ).send ( { message: `Hero data for '${pageID}' deleted successfully.` } )
  } catch ( error ) {
    console.error ( `Error deleting hero data for ${pageID}:`, error )
    return res.status ( 500 ).send ( "Failed to delete hero configuration." )
  }
} )