import { router as analyticsRouter } from "./admin/analytics.js"
import { router as fileExplorerRouter } from "./admin/fileExplorer.js"
import { router as galleryAdminRouter } from "./admin/gallery.js"
import { router as heroEditorRouter } from "./admin/heroEditor.js"
import { router as eventsRouter } from "./admin/events.js"
import { router as contactDetailsRouter } from "./admin/contactDetails.js"
import { router as ourStoryRouter } from "./admin/ourStory.js"
import { router as siteContentRouter } from "./admin/siteContent.js"

import admin, { ServiceAccount } from "firebase-admin"
import { isDevMode, isPreProd } from "./static.js"
import rateLimit from "@fastify/rate-limit"
import { FastifyPluginAsync } from "fastify"
import { config } from "dotenv"
import { resolve } from "path"

let serviceAccount: ServiceAccount
if ( isPreProd ( ) || isDevMode ( ) ) {
  serviceAccount = ( await import ( "../revive-scotland-firebase-dev.json", { with: { type: "json" } } ) ).default as ServiceAccount
} else {
  serviceAccount = ( await import ( "../revive-scotland-firebase.json", { with: { type: "json" } } ) ).default as ServiceAccount
}

config ( { path: resolve ( process.cwd ( ), ".env" ), quiet: true } )

const SUPERADMIN_EMAIL = process.env [ "SUPERADMIN_EMAIL" ]
const ADMIN_EMAIL = process.env [ "ADMIN_EMAIL" ]

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

const isFirebaseAuthError = ( error: unknown ): boolean => {
  if ( error instanceof Error ) {
    const code = ( error as { errorInfo?: { code?: string } } ).errorInfo?.code ?? ""
    return code.startsWith ( "auth/" )
  }
  return false
}

export const router: FastifyPluginAsync = async app => {
  app.register ( analyticsRouter, { prefix: "/analytics" } )
  app.register ( fileExplorerRouter, { prefix: "/file-explorer" } )
  app.register ( galleryAdminRouter, { prefix: "/gallery" } )
  app.register ( heroEditorRouter, { prefix: "/hero-editor" } )
  app.register ( eventsRouter, { prefix: "/events" } )
  app.register ( contactDetailsRouter, { prefix: "/contact-details" } )
  app.register ( ourStoryRouter, { prefix: "/our-story" } )
  app.register ( siteContentRouter, { prefix: "/site-content" } )

  if ( !isDevMode ( ) ) {
    await app.register ( rateLimit, {
      max: 300,
      timeWindow: "15 minute"
    } )
  }

  app.get ( "/logout", async ( req, res ) => {
    const authHeader = req.headers.authorization
    if ( !authHeader?.startsWith ( "Bearer " ) ) {
      return res.status ( 401 ).send ( { error: "Unauthorized" } )
    }

    try {
      const decodedToken = await admin.auth ( ).verifyIdToken ( authHeader.split ( "Bearer " ) [ 1 ] )
      const uid = decodedToken.uid

      await admin.auth ( ).revokeRefreshTokens ( uid )

      const firestore = getFirestore ( ).collection ( "users" ).doc ( uid )
      await firestore.update ( {
        sessionExpiry: admin.firestore.FieldValue.delete ( )
      } )

      return res.status ( 200 ).send ( { message: "User logged out successfully" } )
    } catch ( error ) {
      if ( isFirebaseAuthError ( error ) ) {
        return res.status ( 401 ).send ( { error: "Unauthorized" } )
      }
      console.error ( "Error logging out user:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )

  app.get ( "/verify", async ( req, res ) => {
    const authHeader = req.headers.authorization
    if ( !authHeader?.startsWith ( "Bearer " ) ) {
      return res.status ( 401 ).send ( { error: "Unauthorized" } )
    }

    try {
      const decodedToken = await admin.auth ( ).verifyIdToken ( authHeader.split ( "Bearer " ) [ 1 ] )
      const uid = decodedToken.uid

      const firestore = getFirestore ( ).collection ( "users" ).doc ( uid )
      const doc = await firestore.get ( )

      if ( !doc.exists ) {
        return res.status ( 404 ).send ( { error: "User session not found" } )
      }

      const data = doc.data ( )
      const sessionExpiry: admin.firestore.Timestamp = data?. [ "sessionExpiry" ]

      const user = {
        uid,
        role: data?. [ "role" ] || "viewer",
        profilePhoto: data?. [ "profilePhoto" ] || null
      }

      if ( !sessionExpiry ) {
        return res.status ( 200 ).send ( user )
      }

      if ( sessionExpiry.toDate ( ) < new Date ( ) ) {
        return res.status ( 401 ).send ( { error: "Session has expired" } )
      }

      return res.status ( 200 ).send ( user )
    } catch ( error ) {
      if ( isFirebaseAuthError ( error ) ) {
        return res.status ( 401 ).send ( { error: "Unauthorized" } )
      }
      console.error ( "Error verifying user session:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )

  app.get ( "/newSession", async ( req, res ) => {
    const authHeader = req.headers.authorization
    if ( !authHeader?.startsWith ( "Bearer " ) ) {
      return res.status ( 401 ).send ( { error: "Unauthorized" } )
    }

    try {
      const decodedToken = await admin.auth ( ).verifyIdToken ( authHeader.split ( "Bearer " ) [ 1 ] )
      const uid = decodedToken.uid
      const user = await admin.auth ( ).getUser ( uid )

      let role = user.customClaims?. [ "role" ] || "viewer"

      if ( SUPERADMIN_EMAIL && user.email === SUPERADMIN_EMAIL ) role = "superadmin"
      else if ( ADMIN_EMAIL && user.email === ADMIN_EMAIL ) role = "admin"

      if ( !user.customClaims?. [ "role" ] || user.customClaims [ "role" ] !== role ) {
        await admin.auth ( ).setCustomUserClaims ( uid, { role } )
      }

      const firestore = getFirestore ( ).collection ( "users" ).doc ( uid )

      const doc = await firestore.get ( )

      const needsCaching = !doc.exists || !( doc.data ( )?. [ "profilePhoto" ] || null )
      if ( needsCaching && user.photoURL ) {
        const base64Photo = await cacheProfileImage ( user.photoURL )
        if ( base64Photo ) {
          await firestore.set ( { profilePhoto: base64Photo }, { merge: true } )
        }
      }

      await firestore.set ( {
        lastLogin: admin.firestore.FieldValue.serverTimestamp ( ),
        sessionExpiry: admin.firestore.Timestamp.fromDate ( new Date ( Date.now ( ) + 7 * 24 * 60 * 60 * 1000 ) )
      }, { merge: true } )

      return res.status ( 200 ).send ( { uid: user.uid, role } )
    } catch ( error ) {
      if ( isFirebaseAuthError ( error ) ) {
        return res.status ( 401 ).send ( { error: "Unauthorized" } )
      }
      console.error ( "Error fetching user data:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )

  app.get ( "/isAdmin", async ( req, res ) => {
    const authHeader = req.headers.authorization
    if ( !authHeader?.startsWith ( "Bearer " ) ) {
      return res.status ( 401 ).send ( { error: "Unauthorized" } )
    }

    try {
      const decodedToken = await admin.auth ( ).verifyIdToken ( authHeader.split ( "Bearer " ) [ 1 ] )
      const uid = decodedToken.uid
      const user = await admin.auth ( ).getUser ( uid )

      const role = user.customClaims?. [ "role" ] || "viewer"
      const isAdmin = role === "admin" || role === "superadmin"

      return res.status ( 200 ).send ( { uid, isAdmin } )
    } catch ( error ) {
      if ( isFirebaseAuthError ( error ) ) {
        return res.status ( 401 ).send ( { error: "Unauthorized" } )
      }
      console.error ( "Error fetching user data:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )
}

const cacheProfileImage = async ( url: string ): Promise<string | null> => {
  try {
    const res = await fetch ( url )
    if ( !res.ok ) return null
    const buffer = await res.arrayBuffer ( )
    return Buffer.from ( buffer ).toString ( "base64" )
  } catch {
    return null
  }
}
