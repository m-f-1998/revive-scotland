import { isDevMode, isPreProd } from "../routes/static.js"

type AssessmentResponse = {
  tokenProperties?: {
    valid?: boolean
    invalidReason?: string
    action?: string
    hostname?: string
  }
  riskAnalysis?: {
    score?: number
  }
  error?: {
    message?: string
  }
}

const resolveMinScore = ( ): number => {
  const raw = process.env [ "RECAPTCHA_MIN_SCORE" ]?.trim ( )
  if ( raw != null && raw !== "" ) {
    const parsed = Number ( raw )
    if ( Number.isFinite ( parsed ) && parsed >= 0 && parsed <= 1 ) return parsed
  }
  // Staging / privacy browsers often land ~0.3–0.5; keep prod stricter.
  return isPreProd ( ) ? 0.3 : 0.5
}

export class RecaptchaService {
  /**
   * Verifies the provided reCAPTCHA token against the Google Enterprise API.
   * Throws an error if validation fails or the score is too low.
   */
  public static async verifyToken ( token: string ): Promise<void> {
    if ( isDevMode ( ) ) {
      console.warn ( "reCAPTCHA verification bypassed in DEV_MODE" )
      return
    }

    const apiKey = process.env [ "RECAPTCHA_API_KEY" ]?.trim ( ) || ""
    const siteKey = process.env [ "RECAPTCHA_SITE" ]?.trim ( ) || ""
    const projectId = process.env [ "RECAPTCHA_PROJECT_ID" ]?.trim ( ) || "revive-scotland"
    const referer = process.env [ "PUBLIC_DOMAIN" ]?.trim ( ) || ""
    const minScore = resolveMinScore ( )

    if ( !apiKey || !siteKey ) {
      throw new Error ( "reCAPTCHA is not configured (RECAPTCHA_API_KEY / RECAPTCHA_SITE)." )
    }

    const response = await fetch (
      `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent ( projectId )}/assessments?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...( referer ? { "Referer": referer } : { } )
        },
        body: JSON.stringify ( {
          event: {
            token: token,
            siteKey: siteKey,
            expectedAction: "contactForm"
          }
        } )
      }
    )

    const data = await response.json ( ).catch ( ( ) => ( { } ) ) as AssessmentResponse

    if ( !response.ok ) {
      console.warn (
        "reCAPTCHA assessment HTTP failed:",
        response.status,
        data.error?.message || JSON.stringify ( data ).slice ( 0, 300 )
      )
      throw new Error ( "reCAPTCHA verification HTTP request failed." )
    }

    const valid = !!data.tokenProperties?.valid
    const score = data.riskAnalysis?.score ?? 0
    if ( !valid || score < minScore ) {
      console.warn (
        "reCAPTCHA validation failed:",
        {
          valid,
          score,
          minScore,
          invalidReason: data.tokenProperties?.invalidReason,
          hostname: data.tokenProperties?.hostname,
          action: data.tokenProperties?.action,
          projectId,
          siteKeyPrefix: `${siteKey.slice ( 0, 10 )}…`
        }
      )
      throw new Error ( "reCAPTCHA validation failed or score too low." )
    }
  }
}
