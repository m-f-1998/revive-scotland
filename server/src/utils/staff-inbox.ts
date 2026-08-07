const FALLBACK_INBOX = "luca@revivescotland.co.uk"

/**
 * Inbox for staff-facing notifications (contact form, registration alerts).
 * Prefers SUPERADMIN_EMAIL; falls back to the public Revive address.
 */
export const getStaffInboxEmail = ( ): string => {
  const fromEnv = process.env [ "SUPERADMIN_EMAIL" ]?.trim ( ).toLowerCase ( )
  if ( fromEnv && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test ( fromEnv ) ) {
    return fromEnv
  }
  return FALLBACK_INBOX
}
