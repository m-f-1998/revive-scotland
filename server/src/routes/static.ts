import { extname, join, resolve } from "path"
import { createReadStream, existsSync } from "fs"
import { access, constants, readFile, stat } from "fs/promises"
import { FastifyPluginAsync } from "fastify"
import mime from "mime"

export const isDevMode = ( ): boolean => {
  return process.env [ "DEV_MODE" ] === "true" || process.env [ "DEV_MODE" ] === "1"
}

const clientFolder = join ( process.cwd ( ), "../client" )

export const router: FastifyPluginAsync = async app => {
  app.get ( "*", async ( req, rep ) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const asset = req.params as { "*": string }
    const address = resolve ( clientFolder, asset [ "*" ] )

    if ( !address.startsWith ( clientFolder ) ) {
      return rep.status ( 400 ).send ( "Bad Request" )
    }

    if ( existsSync ( address ) ) {
      try {
        await access ( address, constants.F_OK )
        const stats = await stat ( address )
        if ( stats.isFile ( ) ) {
          const fileExt = extname ( address ).toLowerCase ( )
          const contentType = mime.getType ( fileExt ) || "application/octet-stream"
          const stream = createReadStream ( address )
          return rep.type ( contentType ).send ( stream )
        }
      } catch ( err ) {
        console.error ( err )
        return rep.status ( 500 ).send ( "Internal Server Error: Index File Does Not Exist" )
      }
    }

    try {
      const indexContent = await fetchIndex ( req.cspNonce || "" )
      return rep.type ( "text/html" ).send ( indexContent )
    } catch {
      return rep.status ( 500 ).send ( "Internal Server Error" )
    }
  } )

  const fetchIndex = async ( nonce: string ) => {
    const indexHTML = join ( clientFolder, "index.html" )
    if ( existsSync ( indexHTML ) ) {
      let html = await readFile ( indexHTML, "utf8" )
      if ( nonce ) {
        const metaTag = `<meta name="csp-nonce" content="${nonce}">`
        html = html.replace ( "</head>", `${metaTag}</head>` )
      }
      html = injectGoogleTagManager ( html, nonce )
      return html
    } else {
      throw new Error ( "Index file not found" )
    }
  }

  const injectGoogleTagManager = ( html: string, nonce: string ): string => {
    // Add the above between the </head> and <body> tags
    const gtmScript = `<script nonce="${nonce}" async src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "967e771000ab4f7fac5a2761d3ccc9aa"}'></script>
      <script nonce="${nonce}" async src="https://www.googletagmanager.com/gtag/js?id=G-4HW72T7XW7"></script>
      <script nonce="${nonce}">
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-4HW72T7XW7');
      </script>`

    const bodyIndex = html.indexOf ( "<body>" )
    if ( bodyIndex !== -1 ) {
      return html.slice ( 0, bodyIndex ) + gtmScript + html.slice ( bodyIndex )
    }
    return html + gtmScript
  }
}