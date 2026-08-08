import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { hashCancelToken, newCancelToken, tokensMatch } from "./cancel-token.js"
import { isDevMode } from "../routes/static.js"

describe ( "cancel-token", ( ) => {
  it ( "round-trips a generated token", ( ) => {
    const { token, hash } = newCancelToken ( )
    assert.equal ( hashCancelToken ( token ), hash )
    assert.equal ( tokensMatch ( token, hash ), true )
  } )

  it ( "rejects a wrong token", ( ) => {
    const { hash } = newCancelToken ( )
    assert.equal ( tokensMatch ( "not-the-token", hash ), false )
  } )
} )

describe ( "isDevMode", ( ) => {
  it ( "is false unless DEV_MODE is explicitly enabled", ( ) => {
    const prev = process.env [ "DEV_MODE" ]
    delete process.env [ "DEV_MODE" ]
    assert.equal ( isDevMode ( ), false )
    process.env [ "DEV_MODE" ] = "true"
    assert.equal ( isDevMode ( ), true )
    process.env [ "DEV_MODE" ] = "1"
    assert.equal ( isDevMode ( ), true )
    process.env [ "DEV_MODE" ] = "false"
    assert.equal ( isDevMode ( ), false )
    if ( prev === undefined ) delete process.env [ "DEV_MODE" ]
    else process.env [ "DEV_MODE" ] = prev
  } )
} )
