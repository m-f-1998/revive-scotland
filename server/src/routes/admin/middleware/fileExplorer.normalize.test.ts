import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { normalizeS3Key } from "./fileExplorer.js"

describe ( "normalizeS3Key", ( ) => {
  it ( "accepts normal user keys", ( ) => {
    assert.equal ( normalizeS3Key ( "users/abc/photo.jpg" ), "users/abc/photo.jpg" )
  } )

  it ( "rejects parent-directory segments", ( ) => {
    assert.equal ( normalizeS3Key ( "users/abc/../other/secret.jpg" ), null )
  } )

  it ( "rejects absolute and backslash paths", ( ) => {
    assert.equal ( normalizeS3Key ( "/users/abc/x.jpg" ), null )
    assert.equal ( normalizeS3Key ( "users\\abc\\x.jpg" ), null )
  } )
} )
