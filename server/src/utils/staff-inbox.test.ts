import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getStaffInboxEmail } from "./staff-inbox.js"

describe ( "getStaffInboxEmail", ( ) => {
  it ( "uses SUPERADMIN_EMAIL when set", ( ) => {
    const prev = process.env [ "SUPERADMIN_EMAIL" ]
    process.env [ "SUPERADMIN_EMAIL" ] = "admin@example.com"
    assert.equal ( getStaffInboxEmail ( ), "admin@example.com" )
    if ( prev === undefined ) delete process.env [ "SUPERADMIN_EMAIL" ]
    else process.env [ "SUPERADMIN_EMAIL" ] = prev
  } )

  it ( "falls back to luca@ when unset or invalid", ( ) => {
    const prev = process.env [ "SUPERADMIN_EMAIL" ]
    delete process.env [ "SUPERADMIN_EMAIL" ]
    assert.equal ( getStaffInboxEmail ( ), "luca@revivescotland.co.uk" )
    process.env [ "SUPERADMIN_EMAIL" ] = "not-an-email"
    assert.equal ( getStaffInboxEmail ( ), "luca@revivescotland.co.uk" )
    if ( prev === undefined ) delete process.env [ "SUPERADMIN_EMAIL" ]
    else process.env [ "SUPERADMIN_EMAIL" ] = prev
  } )
} )
