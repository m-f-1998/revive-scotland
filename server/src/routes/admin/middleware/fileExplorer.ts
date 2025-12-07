import { Request, Response, NextFunction } from "express"
import { auth } from "firebase-admin"
import { getAuth } from "../../../routes/admin.js"

declare global {
  namespace Express {
    interface Request {
      user?: auth.DecodedIdToken & { s3Path?: string }
    }
  }
}

export const checkFirebaseAuth = async ( req: Request, res: Response, next: NextFunction ) => {
  const authHeader = req.headers.authorization

  if ( !authHeader || !authHeader.startsWith ( "Bearer " ) ) {
    res.status ( 401 ).send ( "Unauthorized: No token provided." )
    return
  }

  const idToken = authHeader.split ( "Bearer " ) [ 1 ]

  try {
    // Verify the token
    const decodedToken = await getAuth ( ).verifyIdToken ( idToken )

    // Attach the user's info to the request object
    // This now contains uid, email, etc.
    req.user = decodedToken

    next ( )
  } catch ( error ) {
    console.error ( "Error verifying Firebase token:", error )
    res.status ( 403 ).send ( "Forbidden: Invalid token." )
  }
}

// Middleware to add the user's root S3 path
export const addUserPath = ( req: Request, res: Response, next: NextFunction ) => {
  if ( !req.user ) {
    res.status ( 401 ).send ( "Unauthorized: User not authenticated." )
    return
  }

  req.user.s3Path = `users/${req.user.uid}/`
  next ( )
}

// Security check to ensure a user isn't trying to access other folders
export const validateS3Key = ( req: Request, res: Response, next: NextFunction ) => {
  if ( !req.user || !req.user.s3Path ) {
    res.status ( 401 ).send ( "Unauthorized: User not authenticated." )
    return
  }

  const key = req.body?.key || req.query [ "key" ]
  if ( key && !key.startsWith ( req.user?.s3Path ) ) {
    res.status ( 403 ).send ( "Forbidden: Access denied to this resource." )
    return
  }

  // Also check keys for rename/move
  if ( req.body?.oldKey && !req.body?.oldKey.startsWith ( req.user?.s3Path ) ) {
    res.status ( 403 ).send ( "Forbidden: Access denied to source resource." )
    return
  }

  if ( req.body?.newKey && !req.body?.newKey.startsWith ( req.user?.s3Path ) ) {
    res.status ( 403 ).send ( "Forbidden: Access denied to target resource." )
    return
  }

  // The check for '..' is in the router, but adding a check here provides defense-in-depth.
  const relativePath = req.query [ "path" ]
  if ( relativePath && ( typeof relativePath !== "string" || relativePath.includes ( ".." ) ) ) {
    res.status ( 400 ).send ( "Invalid path provided." )
    return
  }

  next ( )
}