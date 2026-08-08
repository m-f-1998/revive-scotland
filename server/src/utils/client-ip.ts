import type { FastifyRequest } from "fastify"

const headerValue = ( value: string | string [ ] | undefined ): string => {
  if ( Array.isArray ( value ) ) return String ( value [ 0 ] || "" ).trim ( )
  return String ( value || "" ).trim ( )
}

export const isIpv4 = ( ip: string ): boolean => {
  const parts = ip.split ( "." )
  if ( parts.length !== 4 ) return false
  return parts.every ( part => {
    if ( !/^\d{1,3}$/.test ( part ) ) return false
    const n = Number ( part )
    return n >= 0 && n <= 255
  } )
}

/** Rough Cloudflare egress ranges (enough to reject edge IPs used as "client"). */
export const isCloudflareIp = ( ip: string ): boolean => {
  const v4 = ip.includes ( "." ) ? ip.split ( "." ).map ( Number ) : null
  if ( v4 && v4.length === 4 && v4.every ( n => Number.isInteger ( n ) && n >= 0 && n <= 255 ) ) {
    const [ a, b ] = v4 as [ number, number, number, number ]
    if ( a === 103 && ( b === 21 || b === 22 || b === 31 ) ) return true
    if ( a === 141 && b === 101 ) return true
    if ( a === 108 && b === 162 ) return true
    if ( a === 190 && b === 93 ) return true
    if ( a === 188 && b === 114 ) return true
    if ( a === 197 && b === 234 ) return true
    if ( a === 198 && b === 41 ) return true
    if ( a === 162 && ( b === 158 || b === 159 ) ) return true
    if ( a === 104 && b >= 16 && b <= 31 ) return true
    if ( a === 172 && b >= 64 && b <= 71 ) return true // 172.64.0.0/13
    if ( a === 131 && b === 0 ) return true
    if ( a === 173 && b === 245 ) return true
  }
  const lower = ip.toLowerCase ( )
  return (
    lower.startsWith ( "2400:cb00:" )
    || lower.startsWith ( "2606:4700:" )
    || lower.startsWith ( "2803:f800:" )
    || lower.startsWith ( "2405:b500:" )
    || lower.startsWith ( "2405:8100:" )
    || lower.startsWith ( "2a06:98c0:" )
    || lower.startsWith ( "2c0f:f248:" )
  )
}

const isLoopback = ( ip: string ): boolean => {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1"
}

const collectCandidates = ( req: FastifyRequest ): string [ ] => {
  const candidates: string [ ] = [ ]

  // Cloudflare Pseudo IPv4 (Network → Pseudo IPv4 → Add header)
  const pseudo = headerValue ( req.headers [ "cf-pseudo-ipv4" ] )
  if ( pseudo ) candidates.push ( pseudo )

  const cf = headerValue ( req.headers [ "cf-connecting-ip" ] )
  if ( cf ) candidates.push ( cf )

  const trueClient = headerValue ( req.headers [ "true-client-ip" ] )
  if ( trueClient ) candidates.push ( trueClient )

  const forwarded = headerValue ( req.headers [ "x-forwarded-for" ] )
  if ( forwarded ) {
    for ( const part of forwarded.split ( "," ) ) {
      const ip = part.trim ( ).replace ( /^\[|\]$/g, "" )
      if ( ip ) candidates.push ( ip )
    }
  }

  const realIp = headerValue ( req.headers [ "x-real-ip" ] )
  if ( realIp ) candidates.push ( realIp )

  if ( typeof req.ip === "string" && req.ip.trim ( ) ) {
    candidates.push ( req.ip.trim ( ) )
  }

  return candidates
}

const pickClientIp = ( candidates: string [ ], preferIpv4: boolean ): string | undefined => {
  const usable = candidates.filter ( ip => ip && !isLoopback ( ip ) && !isCloudflareIp ( ip ) )
  if ( preferIpv4 ) {
    const v4 = usable.find ( isIpv4 )
    if ( v4 ) return v4
  }
  if ( usable [ 0 ] ) return usable [ 0 ]
  return candidates.find ( ip => ip && !isLoopback ( ip ) ) || undefined
}

/**
 * Real visitor IP behind Cloudflare + reverse proxy.
 * Prefer CF-Connecting-IP; never treat a Cloudflare edge address as the client.
 */
export const clientIpFromRequest = ( req: FastifyRequest ): string | undefined => {
  return pickClientIp ( collectCandidates ( req ), false )
}

/**
 * IP for reCAPTCHA Enterprise assessments.
 * Prefers IPv4 (including Cloudflare Pseudo IPv4) when available — some score models
 * treat dual-stack IPv6 paths less confidently than a stable IPv4 identity.
 */
export const clientIpForRecaptcha = ( req: FastifyRequest ): string | undefined => {
  return pickClientIp ( collectCandidates ( req ), true )
}
