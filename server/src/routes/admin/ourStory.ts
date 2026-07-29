import { FastifyPluginAsync } from "fastify"
import { getFirestore } from "../admin.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

export interface StoryItem {
  description: string
  bullet: boolean
}

const DEFAULT: StoryItem [ ] = [
  {
    bullet: false,
    description: "At Revive Scotland, our journey is deeply informed by a robust background in catechesis, bolstered by academic achievements including both a BA in Catholic Theology and an MA in Applied Catholic Theology. This academic foundation enriches our understanding and practice of the faith, enabling us to effectively convey its teachings and significance to others."
  },
  {
    bullet: true,
    description: "Our commitment to youth work under the patronage of St John Bosco extends beyond mere engagement, encompassing a holistic approach to nurturing spiritual growth and real friendships."
  },
  {
    bullet: true,
    description: "Alongside organising pilgrimages, Revive Weekends and other events such as our recent trip to World Youth Day, our dedication to parish-related apostolates especially building Eucharistic Adoration and parish youth groups underscore our hands-on involvement in the everyday life of the Church."
  },
  {
    bullet: true,
    description: "We take pride in fostering transformative spaces through the development and leadership of children's, youth, and young adults groups, providing avenues for exploration and growth in the Catholic faith. Furthermore, we provide comprehensive leadership training for youth group leaders, empowering them to effectively guide and mentor others in their spiritual journeys."
  },
  {
    bullet: false,
    description: "Because of our experience in organising and leading Eucharistic adoration at both parish and mission levels, we are steadfast in our commitment to fostering deep reverence and devotion within our communities. At Revive Scotland, we are dedicated to inspiring spiritual renewal and fostering community cohesion, drawing upon our diverse backgrounds and experiences to serve as catalysts for transformation and growth."
  }
]

let cache: StoryItem [ ] | null = null
let cacheTime = 0
const TTL = 60_000

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    if ( cache && Date.now ( ) - cacheTime < TTL ) {
      return rep.send ( { items: cache } )
    }

    try {
      const doc = await getFirestore ( ).collection ( "site_content" ).doc ( "our-story" ).get ( )
      const data = doc.exists ? ( doc.data ( ) as { items: StoryItem [ ] } ) : { items: DEFAULT }

      cache = data.items
      cacheTime = Date.now ( )

      return rep.status ( 200 ).send ( data )
    } catch ( error ) {
      console.error ( "Error fetching Our Story content:", error )
      return rep.status ( 500 ).send ( "Failed to fetch Our Story content." )
    }
  } )

  app.post ( "/", { preHandler: checkFirebaseAuth }, async ( req, rep ) => {
    const { items } = req.body as { items?: StoryItem [ ] }

    if ( !Array.isArray ( items ) || items.length === 0 ) {
      return rep.status ( 400 ).send ( "items must be a non-empty array." )
    }

    const sanitized: StoryItem [ ] = items.map ( item => ( {
      description: String ( item.description || "" ).trim ( ).substring ( 0, 1000 ),
      bullet: Boolean ( item.bullet )
    } ) )

    try {
      await getFirestore ( ).collection ( "site_content" ).doc ( "our-story" ).set ( { items: sanitized } )
      cache = sanitized
      cacheTime = Date.now ( )
      return rep.status ( 200 ).send ( { message: "Our Story content saved successfully." } )
    } catch ( error ) {
      console.error ( "Error saving Our Story content:", error )
      return rep.status ( 500 ).send ( "Failed to save Our Story content." )
    }
  } )
}
