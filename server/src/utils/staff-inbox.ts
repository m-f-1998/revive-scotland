import { isDevMode, isPreProd } from "../routes/static.js"

const PROD_INBOX = "luca@revivescotland.co.uk"
const NON_PROD_INBOX = "admin@matthewfrankland.co.uk"

const isPreProdDomain = ( ): boolean => {
  const domain = ( process.env [ "PUBLIC_DOMAIN" ] || "" ).toLowerCase ( )
  return domain.includes ( "dev.revivescotland.co.uk" )
}

export const isNonProdStaffRouting = ( ): boolean => {
  return isDevMode ( ) || isPreProd ( ) || isPreProdDomain ( )
}

/**
 * Inbox for staff-facing notifications (contact form, registration alerts).
 * Separate from SUPERADMIN_EMAIL (Firebase admin auth — always admin@matthewfrankland.co.uk).
 */
export const getStaffInboxRecipients = ( ): string [ ] => {
  if ( isNonProdStaffRouting ( ) ) {
    return [ NON_PROD_INBOX ]
  }
  return [ PROD_INBOX ]
}

/** @deprecated Prefer getStaffInboxRecipients */
export const getStaffInboxEmail = ( ): string => {
  return getStaffInboxRecipients ( ) [ 0 ]!
}
