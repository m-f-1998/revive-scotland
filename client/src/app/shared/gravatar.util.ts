import { md5 } from "js-md5"

/** Gravatar image URL, or null if email is missing/invalid. Uses d=404 when no profile photo exists. */
export const gravatarUrlForEmail = ( email: string, sizePx = 80 ): string | null => {
  const normalized = email.trim ( ).toLowerCase ( )
  if ( !normalized.includes ( "@" ) ) return null

  const hash = md5 ( normalized )
  return `https://www.gravatar.com/avatar/${hash}?s=${sizePx}&d=404&r=g`
}
