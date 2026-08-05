import { isDevMode } from "../routes/static.js"

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

    const apiKey = process.env [ "RECAPTCHA_API_KEY" ] || ""
    const siteKey = process.env [ "RECAPTCHA_SITE" ] || ""
    const referer = process.env [ "PUBLIC_DOMAIN" ] || ""

    const response = await fetch (
      `https://recaptchaenterprise.googleapis.com/v1/projects/revive-scotland/assessments?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Referer": referer
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

    if ( !response.ok ) {
      throw new Error ( "reCAPTCHA verification HTTP request failed." )
    }

    const data = await response.json ( ) as { tokenProperties: { valid: boolean }; riskAnalysis: { score: number } }

    if ( !data.tokenProperties.valid || data.riskAnalysis.score < 0.5 ) {
      throw new Error ( "reCAPTCHA validation failed or score too low." )
    }
  }
}
