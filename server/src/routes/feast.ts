import { FastifyPluginAsync } from "fastify"
import sanitizeHtml from "sanitize-html"

interface FeastDay {
  name: string
  colour: string
  date: string
  universalisUrl: string
  readings?: {
    firstReading?: string
    firstReadingSource?: string
    psalm?: string
    psalmSource?: string
    secondReading?: string
    secondReadingSource?: string
    gospelAcclamation?: string
    gospelAcclamationSource?: string
    gospel?: string
    gospelSource?: string
    copyright?: string
  }
}

let feastCache: FeastDay | null = null
let cacheDateKey = ""

const COLOUR_MAP: Record<string, string> = { g: "Green", w: "White", r: "Red", p: "Purple", v: "Violet" }

const getDateKey = ( ): string => {
  const now = new Date ( )
  return `${now.getFullYear ( )}${String ( now.getMonth ( ) + 1 ).padStart ( 2, "0" )}${String ( now.getDate ( ) ).padStart ( 2, "0" )}`
}

const formatDate = ( yyyymmdd: string ): string => {
  const date = new Date (
    parseInt ( yyyymmdd.slice ( 0, 4 ) ),
    parseInt ( yyyymmdd.slice ( 4, 6 ) ) - 1,
    parseInt ( yyyymmdd.slice ( 6, 8 ) )
  )
  return date.toLocaleDateString ( "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" } )
}

// Universalis calendar.json returns HTML. Parse the <tr> row for today's date.
const parseFeastFromHtml = ( html: string, dateKey: string ): { name: string; colour: string } => {
  const markerRegex = new RegExp ( `${dateKey}/today\\.htm` )
  const match = html.match ( markerRegex )
  if ( !match || match.index === undefined ) return { name: "Today's Mass", colour: "Green" }
  const markerIdx = match.index

  // Grab up to the next </tr>
  const rowEnd = html.indexOf ( "</tr>", markerIdx )
  const row = rowEnd !== -1 ? html.slice ( markerIdx, rowEnd ) : html.slice ( markerIdx, markerIdx + 600 )

  // Feast/memorial/sunday name is in <span class="rank-*">
  const rankMatch = row.match ( /<span class="rank-[^"]*">([^<]+)<\/span>/ )
  let name = "Today's Mass"
  if ( rankMatch ) {
    name = rankMatch [ 1 ].replace ( /&#160;/g, " " ).trim ( )
  } else {
    // Ordinary weekday: plain text between </td><td> and &#160; or <
    const plainMatch = row.match ( /<\/a><\/td><td>([^<&#\n]+)/ )
    if ( plainMatch ) name = plainMatch [ 1 ].trim ( )
  }

  // Liturgical colour from first <span class="lit-X">
  const colourMatch = row.match ( /<span class="lit-([a-z]+)">/ )
  const colour = colourMatch ? ( COLOUR_MAP [ colourMatch [ 1 ] ] ?? "Green" ) : "Green"

  return { name, colour }
}

const READING_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [ "p", "br", "strong", "em", "b", "i", "span", "sup", "sub" ],
  allowedAttributes: {
    span: [ "class" ],
  },
  allowedClasses: {
    span: [ "psalm-verse", "psalm-stanza" ],
  },
  // Drop inline styles / event handlers from Universalis HTML
  allowedStyles: { },
}

const cleanReadingHtml = ( html?: string ): string | undefined => {
  if ( !html ) return undefined

  const clean = html
    // 1. Remove float right blocks (they hold an empty <br> that breaks flow)
    .replace ( /<div[^>]*style="[^"]*float:\s*right[^"]*"[^>]*>.*?<\/div>/gi, "" )
    // 2. Psalms often use specific spans. Mark verses bold.
    .replace ( /<span[^>]*class="psalm-verse"[^>]*>([\s\S]*?)<\/span>/gi, ( _match, p1 ) => {
      // It might contain divs, strip them for the bold text
      return `\n\n<strong>${p1.replace ( /<div[^>]*>/gi, "" ).replace ( /<\/div>/gi, "" )}</strong>\n\n`
    } )
    // 3. Stanza breaks via margin-top
    .replace ( /<div[^>]*style="[^"]*margin-top:[^"]*"[^>]*>/gi, "\n\n" )
    // 4. Stanza lines via text-indent
    .replace ( /<div[^>]*style="[^"]*text-indent:[^"]*"[^>]*>/gi, "\n" )
    // 5. Stanza groups in psalms
    .replace ( /<div[^>]*class="psalm-stanza"[^>]*>/gi, "\n\n" )
    // 6. Generic divs usually mean block level elements (paragraphs / new lines)
    .replace ( /<div[^>]*>/gi, "\n" )
    .replace ( /<\/div>/gi, "" )
    // 7. BRs
    .replace ( /<br\s*\/?>/gi, "\n\n" )
    // 8. Clean entities
    .replace ( /&nbsp;|&#160;/gi, " " )
    // 9. Consolidate new lines
    .replace ( /\n{3,}/g, "\n\n" )

  return sanitizeHtml ( clean.trim ( ), READING_SANITIZE )
}

const fetchReadings = async ( ): Promise<FeastDay["readings"]> => {
  try {
    const res = await fetch ( "https://universalis.com/Europe.Scotland/jsonpmass.js" )
    const text = await res.text ( )
    const firstParen = text.indexOf ( "(" )
    const lastParen = text.lastIndexOf ( ")" )
    if ( firstParen !== -1 && lastParen > firstParen ) {
      const jsonStr = text.slice ( firstParen + 1, lastParen ).trim ( )
      const data = JSON.parse ( jsonStr )
      return {
        firstReading: cleanReadingHtml ( data.Mass_R1?.text ),
        firstReadingSource: cleanReadingHtml ( data.Mass_R1?.source ),
        psalm: cleanReadingHtml ( data.Mass_Ps?.text ),
        psalmSource: cleanReadingHtml ( data.Mass_Ps?.source ),
        secondReading: cleanReadingHtml ( data.Mass_R2?.text ),
        secondReadingSource: cleanReadingHtml ( data.Mass_R2?.source ),
        gospelAcclamation: cleanReadingHtml ( data.Mass_GA?.text ),
        gospelAcclamationSource: cleanReadingHtml ( data.Mass_GA?.source ),
        gospel: cleanReadingHtml ( data.Mass_G?.text ),
        gospelSource: cleanReadingHtml ( data.Mass_G?.source ),
        copyright: cleanReadingHtml ( data.copyright?.text )
      }
    }
  } catch ( error ) {
    console.error ( "Failed to fetch readings:", error )
  }
  return undefined
}

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", async ( _req, rep ) => {
    const dateKey = getDateKey ( )

    if ( feastCache && cacheDateKey === dateKey ) {
      return rep.send ( feastCache )
    }

    try {
      const calendarRes = await fetch ( "https://universalis.com/Europe.Scotland/today/calendar.json" )
      const calendarHtml = await calendarRes.text ( )

      const { name, colour } = parseFeastFromHtml ( calendarHtml, dateKey )
      const readings = await fetchReadings ( )

      const result: FeastDay = {
        name,
        colour,
        date: formatDate ( dateKey ),
        universalisUrl: `https://universalis.com/Europe.Scotland/${dateKey}/Mass.htm`,
        readings
      }

      feastCache = result
      cacheDateKey = dateKey

      return rep.status ( 200 ).send ( result )
    } catch ( error ) {
      console.error ( "Error fetching feast data:", error )
      return rep.status ( 500 ).send ( { error: "Failed to fetch feast data." } )
    }
  } )
}
