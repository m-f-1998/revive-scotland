import { FastifyPluginAsync } from "fastify"

interface FeastDay {
  name: string
  colour: string
  date: string
  universalisUrl: string
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
  const marker = `${dateKey}/today.htm">`
  const markerIdx = html.indexOf ( marker )
  if ( markerIdx === -1 ) return { name: "Today's Mass", colour: "Green" }

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

      const result: FeastDay = {
        name,
        colour,
        date: formatDate ( dateKey ),
        universalisUrl: `https://universalis.com/Europe.Scotland/${dateKey}/Mass.htm`
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
