import { extname, join, resolve } from "path"
import { createReadStream } from "fs"
import { access, constants, readFile, stat } from "fs/promises"
import { FastifyPluginAsync } from "fastify"
import mime from "mime"
import { config } from "dotenv"

config ( { path: resolve ( process.cwd ( ), ".env" ), quiet: true } )

export const isDevMode = ( ): boolean => {
  return process.env [ "DEV_MODE" ] === "true" || process.env [ "DEV_MODE" ] === "1"
}

export const isPreProd = ( ): boolean => {
  return process.env [ "PRE_PROD" ] === "true" || process.env [ "PRE_PROD" ] === "1"
}

const clientFolder = join ( process.cwd ( ), "../client" )

// Matches Angular content-hashed filenames, e.g. main-3JHMYRRZ.js, chunk-ABC123DE.css
const HASHED_ASSET_RE = /[-][A-Z0-9]{8}\.(js|css)$/i

// Cached base content of index.html — nonce/GTM injected per-request in memory
let indexHtmlBase: string | null = null

export const router: FastifyPluginAsync = async app => {
  app.get ( "*", async ( req, rep ) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const asset = req.params as { "*": string }
    const rawPath = asset [ "*" ]

    if ( rawPath.includes ( ".." ) ) {
      return rep.status ( 400 ).send ( "Bad Request" )
    }

    const address = resolve ( clientFolder, rawPath )

    if ( !address.startsWith ( clientFolder ) ) {
      return rep.status ( 400 ).send ( "Bad Request" )
    }

    // Async-only file check — avoids blocking the event loop with existsSync
    try {
      await access ( address, constants.F_OK )
      const stats = await stat ( address )
      if ( stats.isFile ( ) ) {
        const fileExt = extname ( address ).toLowerCase ( )
        const contentType = mime.getType ( fileExt ) || "application/octet-stream"

        // Immutable cache for content-hashed JS/CSS; no-cache for HTML
        if ( HASHED_ASSET_RE.test ( rawPath ) ) {
          rep.header ( "cache-control", "public, max-age=31536000, immutable" )
        } else if ( fileExt === ".html" ) {
          rep.header ( "cache-control", "no-cache" )
        }

        const stream = createReadStream ( address )
        return rep.type ( contentType ).send ( stream )
      }
    } catch {
      // File not found or not accessible — fall through to SPA handler
    }

    try {
      const indexContent = await fetchIndex ( req.cspNonce || "" )
      return rep.type ( "text/html" ).header ( "cache-control", "no-cache" ).send ( indexContent )
    } catch {
      return rep.status ( 500 ).send ( "Internal Server Error" )
    }
  } )

  const fetchIndex = async ( nonce: string ) => {
    if ( !indexHtmlBase ) {
      const indexHTML = join ( clientFolder, "index.html" )
      indexHtmlBase = await readFile ( indexHTML, "utf8" )
    }

    let html = indexHtmlBase
    if ( nonce ) {
      const metaTag = `<meta name="csp-nonce" content="${nonce}">`
      html = html.replace ( "</head>", `${metaTag}</head>` )
    }
    html = injectGoogleTagManager ( html, nonce )
    return html
  }

  const injectGoogleTagManager = ( html: string, nonce: string ): string => {
    const cfToken = process.env [ "CF_BEACON_TOKEN" ] ?? ""
    const gaId = process.env [ "GA_TRACKING_ID" ] ?? ""

    const gtmScript = `<script nonce="${nonce}" async src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfToken}"}'></script>
      <script nonce="${nonce}" async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
      <script nonce="${nonce}">
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId}');
      </script>`

    const bodyIndex = html.indexOf ( "<body>" )
    if ( bodyIndex !== -1 ) {
      return html.slice ( 0, bodyIndex ) + gtmScript + html.slice ( bodyIndex )
    }
    return html + gtmScript
  }
}