import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "crypto"
import { SignJWT, jwtVerify, EncryptJWT, jwtDecrypt } from "jose"
import type { JWTPayload } from "jose"
import { pool } from "./db.js"

const ITERATIONS = 310000
const KEYLEN = 64
const DIGEST = "sha512"

// Token lifetime
const ACCESS_TOKEN_EXPIRY = "15m"
const REFRESH_TOKEN_EXPIRY = "3d"
export const SESSION_ACTIVE_LIMIT = 60 * 60 * 1000 // 1 hour

export const issueToken = async ( payload: JWTPayload ) => {
  const WEB_SECRET = Buffer.from ( process.env [ "WEB_SECRET" ]!, "hex" ) // 64 bytes
  const ENCRYPTION_SECRET = Buffer.from ( process.env [ "ENCRYPTION_SECRET" ]!, "hex" ) // 32 bytes

  const accessToken = await generateToken (
    payload,
    ACCESS_TOKEN_EXPIRY,
    WEB_SECRET,
    ENCRYPTION_SECRET
  )

  const refreshToken = await generateToken (
    { sub: payload.sub },
    REFRESH_TOKEN_EXPIRY,
    WEB_SECRET,
    ENCRYPTION_SECRET
  )

  // Add the session ID to the database with last used time
  await pool!.query ( "INSERT INTO sessions ( username, session_token, last_active ) VALUES ( $1, $2, $3 ) ON CONFLICT ( username ) DO UPDATE SET session_token = $2, last_active = $3", [ payload.sub, accessToken.token, new Date ( ) ] )

  return {
    accessToken,
    refreshToken
  }
}

export const verifyToken = async ( token: string, isAccessToken: boolean, updateSessionLastActive: boolean = true ) => {
  try {
    const WEB_SECRET = Buffer.from ( process.env [ "WEB_SECRET" ]!, "hex" ) // 64 bytes
    const ENCRYPTION_SECRET = Buffer.from ( process.env [ "ENCRYPTION_SECRET" ]!, "hex" ) // 32 bytes

    if ( !token ) {
      return null
    }

    const { payload } = await jwtDecrypt ( token, ENCRYPTION_SECRET, { clockTolerance: 5 } )
    const { payload: verified } = await jwtVerify ( payload [ "signed" ] as string, WEB_SECRET, {
      algorithms: [ "HS512" ],
    } )

    await pool!.query ( "DELETE FROM blacklistedTokens WHERE expires_at < NOW()" )

    const isBlacklisted = await pool!.query ( "SELECT * FROM blacklistedTokens WHERE jti = $1", [ verified.jti ] )
    if ( isBlacklisted.rowCount && isBlacklisted.rowCount > 0 ) {
      return null
    }

    if ( isAccessToken ) {
      if ( !( await sessionActive ( token ) ) ) {
        console.log ( "Session inactive or expired." )
        return null
      }
      if ( updateSessionLastActive ) {
        // Update session last active time
        await pool!.query ( "UPDATE sessions SET last_active = $1 WHERE session_token = $2", [ new Date ( ), token ] )
      }
    }

    return verified
  } catch ( error ) {
    console.error ( "Error while verifying token:", error )
    return null
  }
}

export const sessionActive = async ( token: string ) => {
  const isActive = await pool!.query ( "SELECT * FROM sessions WHERE session_token = $1 AND last_active > $2", [ token, new Date ( Date.now ( ) - SESSION_ACTIVE_LIMIT ) ] )
  return isActive.rowCount && isActive.rowCount > 0
}

export const useRefreshToken = async ( refreshToken: string ) => {
  if ( !refreshToken ) {
    return false
  }

  try {
    const payload = await verifyToken ( refreshToken, false )
    if ( !payload ) {
      return false
    }

    const WEB_SECRET = Buffer.from ( process.env [ "WEB_SECRET" ]!, "hex" ) // 64 bytes
    const ENCRYPTION_SECRET = Buffer.from ( process.env [ "ENCRYPTION_SECRET" ]!, "hex" ) // 32 bytes

    return await generateToken (
      payload,
      ACCESS_TOKEN_EXPIRY,
      WEB_SECRET,
      ENCRYPTION_SECRET
    )
  } catch ( error ) {
    console.error ( "Error while using refresh token:", error )
    return false
  }
}

export const generateToken = async ( payload: JWTPayload, expiry: string, secret: Buffer<ArrayBuffer>, encryptionSecret: Buffer<ArrayBuffer> ) => {
  const signed = await new SignJWT ( {
    ...payload,
    jti: randomUUID ( )
  } )
    .setProtectedHeader ( { alg: "HS512" } )
    .setIssuedAt ()
    .setExpirationTime ( expiry )
    .sign ( secret )

  const encrypted = await new EncryptJWT ( { signed } )
    .setProtectedHeader ( { alg: "dir", enc: "A256GCM" } )
    .setIssuedAt ()
    .setExpirationTime ( expiry )
    .encrypt ( encryptionSecret )


  // Turn the expiry string into a number for secure cookie maxAge
  let maxAge = 0
  const match = expiry.match ( /^(\d+)([smhd])$/ )
  if ( match ) {
    const value = parseInt ( match [ 1 ], 10 )
    const unit = match [ 2 ]
    switch ( unit ) {
      case "s":
        maxAge = value * 1000
        break
      case "m":
        maxAge = value * 60 * 1000
        break
      case "h":
        maxAge = value * 60 * 60 * 1000
        break
      case "d":
        maxAge = value * 24 * 60 * 60 * 1000
        break
    }
  }

  return {
    token: encrypted,
    age: maxAge
  }
}

export const verifyPassword = ( password: string, storedSalt: string, storedHash: string ): boolean => {
  const hash = pbkdf2Sync ( password, storedSalt, ITERATIONS, KEYLEN, DIGEST ).toString ( "hex" )

  // Use timingSafeEqual to prevent timing attacks
  return timingSafeEqual (
    Buffer.from ( storedHash, "hex" ),
    Buffer.from ( hash, "hex" )
  )
}

export const hashPassword = ( password: string ): {
  salt: string
  hash: string
} => {
  const salt = randomBytes ( 32 ).toString ( "hex" ) // 32-byte salt
  const hash = pbkdf2Sync ( password, salt, ITERATIONS, KEYLEN, DIGEST ).toString ( "hex" )
  return { salt, hash }
}