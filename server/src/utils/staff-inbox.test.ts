import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getStaffInboxEmail, getStaffInboxRecipients } from "./staff-inbox.js"

describe ( "getStaffInboxEmail", ( ) => {
  const restore = ( key: string, prev: string | undefined ): void => {
    if ( prev === undefined ) delete process.env [ key ]
    else process.env [ key ] = prev
  }

  it ( "uses non-prod inbox in dev mode regardless of SUPERADMIN_EMAIL", ( ) => {
    const prevAdmin = process.env [ "SUPERADMIN_EMAIL" ]
    const prevDev = process.env [ "DEV_MODE" ]
    const prevDomain = process.env [ "PUBLIC_DOMAIN" ]
    process.env [ "SUPERADMIN_EMAIL" ] = "admin@matthewfrankland.co.uk"
    process.env [ "DEV_MODE" ] = "true"
    delete process.env [ "PRE_PROD" ]
    delete process.env [ "PUBLIC_DOMAIN" ]
    assert.deepEqual ( getStaffInboxRecipients ( ), [ "admin@matthewfrankland.co.uk" ] )
    assert.equal ( getStaffInboxEmail ( ), "admin@matthewfrankland.co.uk" )
    restore ( "SUPERADMIN_EMAIL", prevAdmin )
    restore ( "DEV_MODE", prevDev )
    restore ( "PUBLIC_DOMAIN", prevDomain )
  } )

  it ( "uses non-prod inbox in pre-prod regardless of SUPERADMIN_EMAIL", ( ) => {
    const prevAdmin = process.env [ "SUPERADMIN_EMAIL" ]
    const prevPre = process.env [ "PRE_PROD" ]
    const prevDomain = process.env [ "PUBLIC_DOMAIN" ]
    process.env [ "SUPERADMIN_EMAIL" ] = "admin@matthewfrankland.co.uk"
    process.env [ "PRE_PROD" ] = "true"
    delete process.env [ "DEV_MODE" ]
    delete process.env [ "PUBLIC_DOMAIN" ]
    assert.deepEqual ( getStaffInboxRecipients ( ), [ "admin@matthewfrankland.co.uk" ] )
    restore ( "SUPERADMIN_EMAIL", prevAdmin )
    restore ( "PRE_PROD", prevPre )
    restore ( "PUBLIC_DOMAIN", prevDomain )
  } )

  it ( "uses non-prod inbox when PUBLIC_DOMAIN is dev.revivescotland.co.uk", ( ) => {
    const prevPre = process.env [ "PRE_PROD" ]
    const prevDev = process.env [ "DEV_MODE" ]
    const prevDomain = process.env [ "PUBLIC_DOMAIN" ]
    delete process.env [ "PRE_PROD" ]
    delete process.env [ "DEV_MODE" ]
    process.env [ "PUBLIC_DOMAIN" ] = "https://dev.revivescotland.co.uk"
    assert.deepEqual ( getStaffInboxRecipients ( ), [ "admin@matthewfrankland.co.uk" ] )
    restore ( "PRE_PROD", prevPre )
    restore ( "DEV_MODE", prevDev )
    restore ( "PUBLIC_DOMAIN", prevDomain )
  } )

  it ( "uses production inbox when not dev/pre-prod even if SUPERADMIN_EMAIL is set", ( ) => {
    const prevAdmin = process.env [ "SUPERADMIN_EMAIL" ]
    const prevDev = process.env [ "DEV_MODE" ]
    const prevPre = process.env [ "PRE_PROD" ]
    const prevDomain = process.env [ "PUBLIC_DOMAIN" ]
    process.env [ "SUPERADMIN_EMAIL" ] = "admin@matthewfrankland.co.uk"
    delete process.env [ "DEV_MODE" ]
    delete process.env [ "PRE_PROD" ]
    delete process.env [ "PUBLIC_DOMAIN" ]
    assert.deepEqual ( getStaffInboxRecipients ( ), [ "luca@revivescotland.co.uk" ] )
    restore ( "SUPERADMIN_EMAIL", prevAdmin )
    restore ( "DEV_MODE", prevDev )
    restore ( "PRE_PROD", prevPre )
    restore ( "PUBLIC_DOMAIN", prevDomain )
  } )
} )
