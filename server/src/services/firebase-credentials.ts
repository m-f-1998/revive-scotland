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

  // Local/dev fallback only — files must stay gitignored and out of Docker images
  if ( isDevMode ( ) || isPreProd ( ) ) {
    const file = resolve ( process.cwd ( ), "src/revive-scotland-firebase-dev.json" )
    return JSON.parse ( readFileSync ( file, "utf8" ) ) as ServiceAccount
  }

  const prodFile = resolve ( process.cwd ( ), "src/revive-scotland-firebase.json" )
  try {
    return JSON.parse ( readFileSync ( prodFile, "utf8" ) ) as ServiceAccount
  } catch {
    throw new Error (
      "Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
    )
  }
}
