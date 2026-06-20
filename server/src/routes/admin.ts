import { router as analyticsRouter } from "./admin/analytics.js"
import { router as fileExplorerRouter } from "./admin/fileExplorer.js"
import { router as heroEditorRouter } from "./admin/heroEditor.js"
import { router as eventsRouter } from "./admin/events.js"

import { initializeApp, cert, ServiceAccount } from "firebase-admin/app"
import { getAuth as getFirebaseAuth, Auth } from "firebase-admin/auth"
import { getFirestore as getFirebaseFirestore, Firestore, FieldValue, Timestamp } from "firebase-admin/firestore"
import serviceAccount from "../revive-scotland-firebase.json" with { type: "json" }
import { isDevMode } from "./static.js"
import rateLimit from "@fastify/rate-limit"
import { FastifyPluginAsync } from "fastify"

initializeApp ( {
  credential: cert ( serviceAccount as ServiceAccount )
} )

export const getAuth = ( ): Auth => {
  return getFirebaseAuth ( )
}

export const getFirestore = ( ): Firestore => {
  return getFirebaseFirestore ( )
}

export const incrementValue = ( value: number ): FieldValue => {
  return FieldValue.increment ( value )
}

export const router: FastifyPluginAsync = async app => {
  app.register ( analyticsRouter, { prefix: "/analytics" } )
  app.register ( fileExplorerRouter, { prefix: "/file-explorer" } )
  app.register ( heroEditorRouter, { prefix: "/hero-editor" } )
  app.register ( eventsRouter, { prefix: "/events" } )

  if ( !isDevMode ( ) ) {
    await app.register ( rateLimit, {
      max: 300,
      timeWindow: "15 minute"
    } )
  }

  app.get ( "/logout", async ( req, res ) => {
    const { uid } = req.query as { uid?: string }

    if ( !uid ) {
      return res.status ( 400 ).send ( { error: "Missing uid parameter" } )
    }

    try {
      await getAuth ( ).revokeRefreshTokens ( uid )

      const firestore = getFirestore ( ).collection ( "users" ).doc ( uid )
      await firestore.update ( {
        sessionExpiry: FieldValue.delete ( )
      } )

      return res.status ( 200 ).send ( { message: "User logged out successfully" } )
    } catch ( error ) {
      console.error ( "Error logging out user:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )

  app.get ( "/verify", async ( req, res ) => {
    const { uid } = req.query as { uid?: string }

    if ( !uid ) {
      return res.status ( 400 ).send ( { error: "Missing uid parameter" } )
    }

    try {
      const firestore = getFirestore ( ).collection ( "users" ).doc ( uid )
      const doc = await firestore.get ( )

      if ( !doc.exists ) {
        return res.status ( 404 ).send ( { error: "User session not found" } )
      }

      const data = doc.data ( )
      const sessionExpiry: Timestamp = data?. [ "sessionExpiry" ]

      const user = {
        uid,
        role: data?. [ "role" ] || "viewer",
        profilePhoto: data?. [ "profilePhoto" ] || null
      }

      if ( !sessionExpiry ) {
        // If doc found but no sessionExpiry, the session was revoked with Google
        // Can assume a new session is being created
        return res.status ( 200 ).send ( user )
      }

      if ( sessionExpiry.toDate ( ) < new Date ( ) ) {
        return res.status ( 401 ).send ( { error: "Session has expired" } )
      }

      return res.status ( 200 ).send ( user )
    } catch ( error ) {
      console.error ( "Error verifying user session:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )

  app.get ( "/newSession", async ( req, res ) => {
    const { uid } = req.query as { uid?: string }

    if ( !uid ) {
      return res.status ( 400 ).send ( { error: "Missing uid parameter" } )
    }

    try {
      const user = await getAuth ( ).getUser ( uid )
      if ( !user ) {
        return res.status ( 404 ).send ( { error: "User not found" } )
      }

      let role = user.customClaims?. [ "role" ] || "viewer"

      if ( user.email === "admin@matthewfrankland.co.uk" ) role = "superadmin"
      else if ( user.email === "revivescotlandx@gmail.com" ) role = "admin"

      if ( !user.customClaims?. [ "role" ] || user.customClaims [ "role" ] !== role ) {
        await getAuth ( ).setCustomUserClaims ( uid, { role } )
      }

      // Store the Session Expiry time here in Firestore
      const firestore = getFirestore ( ).collection ( "users" ).doc ( uid )

      // Get photoURL
      const doc = await firestore.get ( )

      if ( doc.exists ) {
        if ( !( doc.data ( )?. [ "profilePhoto" ] || null ) ) {
          await cacheProfileImage ( user.photoURL || "" )
        }
      } else {
        await cacheProfileImage ( user.photoURL || "" )
      }

      await firestore.set ( {
        lastLogin: FieldValue.serverTimestamp ( ),
        sessionExpiry: Timestamp.fromDate ( new Date ( Date.now ( ) + 7 * 24 * 60 * 60 * 1000 ) ) // 7 days
      }, { merge: true } )

      return res.status ( 200 ).send ( { uid: user.uid, role } )
    } catch ( error ) {
      console.error ( "Error fetching user data:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )

  app.get ( "/isAdmin", async ( req, res ) => {
    const { uid } = req.query as { uid?: string }

    if ( !uid ) {
      return res.status ( 400 ).send ( { error: "Missing uid parameter" } )
    }

    try {
      const user = await getAuth ( ).getUser ( uid )
      if ( !user ) {
        return res.status ( 404 ).send ( { error: "User not found" } )
      }

      const role = user.customClaims?. [ "role" ] || "viewer"
      const isAdmin = role === "admin" || role === "superadmin"

      return res.status ( 200 ).send ( { uid: user.uid, isAdmin } )
    } catch ( error ) {
      console.error ( "Error fetching user data:", error )
      return res.status ( 500 ).send ( { error: "Internal server error" } )
    }
  } )
}

const cacheProfileImage = async ( url: string ) => {
  const res = await fetch ( url )
  const buffer = await res.arrayBuffer ( )
  return Buffer.from ( buffer ).toString ( "base64" )
}
