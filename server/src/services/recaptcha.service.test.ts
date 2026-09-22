import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  classifyRecaptchaFailure,
  recaptchaTestToken,
  resolveRecaptchaTestFailure
} from "./recaptcha.service.js"

describe ( "classifyRecaptchaFailure", ( ) => {
  it ( "returns retryable BROWSER_ERROR with actionable message", ( ) => {
    const err = classifyRecaptchaFailure ( {
      valid: false,
      invalidReason: "BROWSER_ERROR",
      actionMatches: true,
      scoreOk: false
    } )

    assert.equal ( err.code, "BROWSER_ERROR" )
    assert.equal ( err.retryable, true )
    assert.match ( err.userMessage, /restricted WiFi|ad blockers/i )
  } )

  it ( "returns retryable INVALID_TOKEN for other invalid tokens", ( ) => {
    const err = classifyRecaptchaFailure ( {
      valid: false,
      invalidReason: "MALFORMED",
      actionMatches: true,
      scoreOk: false
    } )

    assert.equal ( err.code, "INVALID_TOKEN" )
    assert.equal ( err.retryable, true )
  } )

  it ( "returns retryable ACTION_MISMATCH", ( ) => {
    const err = classifyRecaptchaFailure ( {
      valid: true,
      actionMatches: false,
      scoreOk: true
    } )

    assert.equal ( err.code, "ACTION_MISMATCH" )
    assert.equal ( err.retryable, true )
  } )

  it ( "returns non-retryable SCORE_TOO_LOW", ( ) => {
    const err = classifyRecaptchaFailure ( {
      valid: true,
      actionMatches: true,
      scoreOk: false
    } )

    assert.equal ( err.code, "SCORE_TOO_LOW" )
    assert.equal ( err.retryable, false )
  } )
} )

describe ( "resolveRecaptchaTestFailure", ( ) => {
  const envBackup: Record<string, string | undefined> = { }

  const restoreEnv = ( ) => {
    for ( const [ key, value ] of Object.entries ( envBackup ) ) {
      if ( value === undefined ) delete process.env [ key ]
      else process.env [ key ] = value
    }
  }

  it ( "simulates each localhost test mode", ( ) => {
    envBackup [ "DEV_MODE" ] = process.env [ "DEV_MODE" ]
    process.env [ "DEV_MODE" ] = "true"

    try {
      const cases = [
        { mode: "browser-error", code: "BROWSER_ERROR", retryable: true },
        { mode: "invalid-token", code: "INVALID_TOKEN", retryable: true },
        { mode: "action-mismatch", code: "ACTION_MISMATCH", retryable: true },
        { mode: "score-too-low", code: "SCORE_TOO_LOW", retryable: false },
        { mode: "http-failed", code: "HTTP_FAILED", retryable: true },
        { mode: "not-configured", code: "NOT_CONFIGURED", retryable: false }
      ] as const

      for ( const { mode, code, retryable } of cases ) {
        const err = resolveRecaptchaTestFailure ( recaptchaTestToken ( mode ) )
        assert.ok ( err, mode )
        assert.equal ( err!.code, code, mode )
        assert.equal ( err!.retryable, retryable, mode )
      }
    } finally {
      restoreEnv ( )
    }
  } )
} )
