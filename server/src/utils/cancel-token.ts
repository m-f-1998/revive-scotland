import { createHash, randomBytes, timingSafeEqual } from "crypto"

export const hashCancelToken = ( token: string ): string =>
  createHash ( "sha256" ).update ( token ).digest ( "hex" )

export const tokensMatch = ( provided: string, storedHash: string ): boolean => {
  const a = Buffer.from ( hashCancelToken ( provided ), "utf8" )
  const b = Buffer.from ( storedHash, "utf8" )
  return a.length === b.length && timingSafeEqual ( a, b )
}

export const newCancelToken = ( ): { token: string; hash: string } => {
  const token = randomBytes ( 32 ).toString ( "base64url" )
  return { token, hash: hashCancelToken ( token ) }
}
