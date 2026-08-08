import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { FastifyRequest } from "fastify"
import {
  clientIpForRecaptcha,
  clientIpFromRequest,
  isCloudflareIp
} from "./client-ip.js"

const fakeReq = ( headers: Record<string, string>, ip = "172.71.241.117" ): FastifyRequest => {
  return { headers, ip } as unknown as FastifyRequest
}

describe ( "clientIpFromRequest", ( ) => {
  it ( "detects Cloudflare egress addresses", ( ) => {
    assert.equal ( isCloudflareIp ( "172.71.241.117" ), true )
    assert.equal ( isCloudflareIp ( "1.2.3.4" ), false )
  } )

  it ( "prefers CF-Connecting-IP over Fastify req.ip", ( ) => {
    const ip = clientIpFromRequest ( fakeReq ( {
      "cf-connecting-ip": "203.0.113.50",
      "x-forwarded-for": "203.0.113.50, 172.71.241.117"
    }, "172.71.241.117" ) )
    assert.equal ( ip, "203.0.113.50" )
  } )

  it ( "skips Cloudflare hops in X-Forwarded-For", ( ) => {
    const ip = clientIpFromRequest ( fakeReq ( {
      "x-forwarded-for": "198.51.100.20, 172.71.241.117"
    }, "172.71.241.117" ) )
    assert.equal ( ip, "198.51.100.20" )
  } )

  it ( "prefers IPv4 / Pseudo IPv4 for reCAPTCHA when dual-stack", ( ) => {
    const ip = clientIpForRecaptcha ( fakeReq ( {
      "cf-pseudo-ipv4": "203.0.113.77",
      "cf-connecting-ip": "2a00:23c4:da12:aa00:9977:8f66:a4a8:4e92"
    } ) )
    assert.equal ( ip, "203.0.113.77" )
  } )
} )
