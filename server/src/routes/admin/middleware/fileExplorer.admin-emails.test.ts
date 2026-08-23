import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getAdminEmails, isEmailAdmin, normalizeAdminEmail } from "./fileExplorer.js"

describe ( "admin email allowlist", ( ) => {
  const restore = ( key: string, prev: string | undefined ): void => {
    if ( prev === undefined ) delete process.env [ key ]
    else process.env [ key ] = prev
  }

  it ( "normalizes googlemail.com to gmail.com", ( ) => {
    assert.equal ( normalizeAdminEmail ( "Luca@googlemail.com" ), "luca@gmail.com" )
    assert.equal ( normalizeAdminEmail ( "luca@gmail.com" ), "luca@gmail.com" )
  } )

  it ( "splits comma-separated ADMIN_EMAIL values", ( ) => {
    const prevAdmin = process.env [ "ADMIN_EMAIL" ]
    const prevEmails = process.env [ "ADMIN_EMAILS" ]
    const prevSuper = process.env [ "SUPERADMIN_EMAIL" ]
    delete process.env [ "ADMIN_EMAILS" ]
    delete process.env [ "SUPERADMIN_EMAIL" ]
    process.env [ "ADMIN_EMAIL" ] = "lucamcq@googlemail.com,321.cmorgan@gmail.com"

    assert.deepEqual ( getAdminEmails ( ), [
      "lucamcq@gmail.com",
      "321.cmorgan@gmail.com"
    ] )
    assert.equal ( isEmailAdmin ( "lucamcq@gmail.com" ), true )
    assert.equal ( isEmailAdmin ( "lucamcq@googlemail.com" ), true )

    restore ( "ADMIN_EMAIL", prevAdmin )
    restore ( "ADMIN_EMAILS", prevEmails )
    restore ( "SUPERADMIN_EMAIL", prevSuper )
  } )
} )
