import { Router } from "express"
import type { Request, Response } from "express"

import { router as analyticsRouter } from "./admin/analytics.js"
import { router as fileExplorerRouter } from "./admin/fileExplorer.js"

export const router: Router = Router ( )
router.use ( "/analytics", analyticsRouter )
router.use ( "/file-explorer", fileExplorerRouter )

import admin, { ServiceAccount } from "firebase-admin"
import serviceAccount from "../revive-scotland-firebase.json" with { type: "json" }
import { rateLimit } from "express-rate-limit"

admin.initializeApp ( {
  credential: admin.credential.cert ( serviceAccount as ServiceAccount )
} )

export const getAuth = ( ): admin.auth.Auth => {
  return admin.auth ( )
}

export const getFirestore = ( ): admin.firestore.Firestore => {
  return admin.firestore ( )
}

export const incrementValue = ( value: number ): admin.firestore.FieldValue => {
  return admin.firestore.FieldValue.increment ( value )
}

router.use ( rateLimit ( {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
} ) )

router.get ( "/role", async ( req: Request, res: Response ) => {
  const uid = req.query [ "uid" ] as string

  if ( !uid ) {
    return res.status ( 400 ).json ( { error: "Missing uid parameter" } )
  }

  try {
    const user = await admin.auth ( ).getUser ( uid )
    if ( !user ) {
      return res.status ( 404 ).json ( { error: "User not found" } )
    }

    let role = user.customClaims?. [ "role" ] || "viewer"

    if ( user.email === "admin@matthewfrankland.co.uk" ) role = "superadmin"
    else if ( user.email === "revivescotlandx@gmail.com" ) role = "admin"

    if ( !user.customClaims?. [ "role" ] || user.customClaims [ "role" ] !== role ) {
      await admin.auth ( ).setCustomUserClaims ( uid, { role } )
    }

    return res.status ( 200 ).json ( { uid: user.uid, role } )
  } catch ( error ) {
    console.error ( "Error fetching user data:", error )
    return res.status ( 500 ).json ( { error: "Internal server error" } )
  }
} )

router.get ( "/isAdmin", async ( req: Request, res: Response ) => {
  const uid = req.query [ "uid" ] as string

  if ( !uid ) {
    return res.status ( 400 ).json ( { error: "Missing uid parameter" } )
  }

  try {
    const user = await admin.auth ( ).getUser ( uid )
    if ( !user ) {
      return res.status ( 404 ).json ( { error: "User not found" } )
    }

    const role = user.customClaims?. [ "role" ] || "viewer"
    const isAdmin = role === "admin" || role === "superadmin"

    return res.status ( 200 ).json ( { uid: user.uid, isAdmin } )
  } catch ( error ) {
    console.error ( "Error fetching user data:", error )
    return res.status ( 500 ).json ( { error: "Internal server error" } )
  }
} )
