import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { FastifyRequest } from "fastify"
import { clientIpFromRequest, isCloudflareIp } from "./client-ip.js"

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
} )
