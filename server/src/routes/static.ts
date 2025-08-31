import express, { Router, Request } from "express"
import type { Response } from "express"
import { join } from "path"
import { existsSync } from "fs"
import { readFile } from "fs/promises"

export const router = Router ( )

router.use ( express.static ( join ( process.cwd ( ), "../client" ), {
  maxAge: "1d",
  etag: true,
  index: false,
} ) )

router.get ( "*get", async ( _req: Request, res: Response ) => {
  const indexPath = join ( process.cwd ( ), "../client/index.html" )
  if ( existsSync ( indexPath ) ) {
    const html = await readFile ( indexPath, "utf8" )
    const nonce = res.locals [ "cspNonce" ]
    const metaTag = `<meta name="csp-nonce" content="${nonce}">`
    const updatedHtml = html.replace ( "</head>", `${metaTag}</head>` )
    res.send ( injectGoogleTagManager ( updatedHtml, nonce ) )
  } else {
    res.status ( 404 ).send ( "Index file not found." )
  }
} )

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