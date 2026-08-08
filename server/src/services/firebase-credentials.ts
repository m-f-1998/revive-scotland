import { readFileSync } from "fs"
import { resolve } from "path"
import { ServiceAccount } from "firebase-admin/app"
import { isDevMode, isPreProd } from "../routes/static.js"

/**
 * Load Firebase service account from env / mounted secret — never bake keys into images.
 * Priority: FIREBASE_SERVICE_ACCOUNT_JSON → GOOGLE_APPLICATION_CREDENTIALS → local JSON (DEV only).
 */
export const loadFirebaseServiceAccount = ( ): ServiceAccount => {
  const inline = process.env [ "FIREBASE_SERVICE_ACCOUNT_JSON" ]
  if ( inline?.trim ( ) ) {
    return JSON.parse ( inline ) as ServiceAccount
  }

  const credPath = process.env [ "GOOGLE_APPLICATION_CREDENTIALS" ]
  if ( credPath?.trim ( ) ) {
    return JSON.parse ( readFileSync ( credPath, "utf8" ) ) as ServiceAccount
  }

  // Local/dev + Docker layout (JSON next to cwd in images, under src/ for local)
  if ( isDevMode ( ) || isPreProd ( ) ) {
    for ( const rel of [ "revive-scotland-firebase-dev.json", "src/revive-scotland-firebase-dev.json" ] ) {
      try {
        return JSON.parse ( readFileSync ( resolve ( process.cwd ( ), rel ), "utf8" ) ) as ServiceAccount
      } catch {
        // try next
      }
    }
  }

  for ( const rel of [ "revive-scotland-firebase.json", "src/revive-scotland-firebase.json" ] ) {
    try {
      return JSON.parse ( readFileSync ( resolve ( process.cwd ( ), rel ), "utf8" ) ) as ServiceAccount
    } catch {
      // try next
    }
  }

  throw new Error (
    "Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
  )
}
