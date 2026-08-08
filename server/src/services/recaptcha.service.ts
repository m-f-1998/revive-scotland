import type { FastifyRequest } from "fastify"
import { isDevMode } from "../routes/static.js"
import { clientIpForRecaptcha } from "../utils/client-ip.js"

export { clientIpForRecaptcha, clientIpFromRequest } from "../utils/client-ip.js"

type AssessmentResponse = {
  tokenProperties?: {
    valid?: boolean
    invalidReason?: string
    action?: string
    hostname?: string
  }
  riskAnalysis?: {
    score?: number
    reasons?: string [ ]
    extendedVerdictReasons?: string [ ]
  }
  error?: {
    message?: string
  }
}

export type RecaptchaVerifyContext = {
  userIpAddress?: string
  userAgent?: string
  requestedUri?: string
  /** Must match the action used in client `grecaptcha.execute`. */
  expectedAction?: string
}

/** Human-readable notes for ClassificationReason values from the assessment. */
const REASON_DESCRIPTIONS: Record<string, string> = {
  CLASSIFICATION_REASON_UNSPECIFIED: "No specific risk classification was provided.",
  AUTOMATION: "Interactions matched automated / bot-like behaviour.",
  UNEXPECTED_ENVIRONMENT: "The event originated from an unexpected or illegitimate environment.",
  TOO_MUCH_TRAFFIC: "Traffic volume from this source is higher than normal.",
  UNEXPECTED_USAGE_PATTERNS: "Usage patterns differed significantly from expected site behaviour.",
  LOW_CONFIDENCE_SCORE: "Too little traffic on this site/key so far for a high-confidence score (common on new or low-traffic hosts like pre-prod)."
}

const describeReasons = ( reasons: string [ ] | undefined ): string [ ] => {
  if ( !reasons?.length ) return [ ]
  return reasons.map ( reason => {
    const detail = REASON_DESCRIPTIONS [ reason ]
    return detail ? `${reason}: ${detail}` : reason
  } )
}

const resolveMinScore = ( ): number => {
  const raw = process.env [ "RECAPTCHA_MIN_SCORE" ]?.trim ( )
  if ( raw != null && raw !== "" ) {
    const parsed = Number ( raw )
    if ( Number.isFinite ( parsed ) && parsed >= 0 && parsed <= 1 ) return parsed
  }
  return 0.5
}

export const recaptchaContextFromRequest = ( req: FastifyRequest ): RecaptchaVerifyContext => {
  const userAgent = String ( req.headers [ "user-agent" ] || "" ).trim ( )
  const origin = process.env [ "PUBLIC_DOMAIN" ]?.replace ( /\/$/, "" ) || ""
  const path = req.url?.split ( "?" ) [ 0 ] || "/"
  return {
    userIpAddress: clientIpForRecaptcha ( req ),
    userAgent: userAgent || undefined,
    requestedUri: origin ? `${origin}${path}` : undefined
  }
}

export class RecaptchaService {
  /**
   * Verifies the provided reCAPTCHA token against the Google Enterprise API.
   * Throws an error if validation fails or the score is too low.
   */
  public static async verifyToken ( token: string, context: RecaptchaVerifyContext = { } ): Promise<void> {
    if ( isDevMode ( ) ) {
      console.warn ( "reCAPTCHA verification bypassed in DEV_MODE" )
      return
    }

    const apiKey = process.env [ "RECAPTCHA_API_KEY" ]?.trim ( ) || ""
    const siteKey = process.env [ "RECAPTCHA_SITE" ]?.trim ( ) || ""
    const projectId = process.env [ "RECAPTCHA_PROJECT_ID" ]?.trim ( ) || "revive-scotland"
    const referer = process.env [ "PUBLIC_DOMAIN" ]?.trim ( ) || ""
    const minScore = resolveMinScore ( )
    const expectedAction = context.expectedAction?.trim ( ) || "contact_submit"

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
            token,
            siteKey,
            expectedAction,
            ...( context.userIpAddress ? { userIpAddress: context.userIpAddress } : { } ),
            ...( context.userAgent ? { userAgent: context.userAgent } : { } ),
            ...( context.requestedUri ? { requestedUri: context.requestedUri } : { } )
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
    const tokenAction = data.tokenProperties?.action || ""
    const actionMatches = !tokenAction
      || tokenAction.toLowerCase ( ) === expectedAction.toLowerCase ( )
    const reasons = data.riskAnalysis?.reasons || [ ]
    const reasonDescriptions = describeReasons ( reasons )
    const extendedVerdictReasons = data.riskAnalysis?.extendedVerdictReasons || [ ]
    const noRiskReasons = reasons.length === 0 && extendedVerdictReasons.length === 0
    // Borderline scores with no classification are often low-confidence, not bot signals.
    const effectiveMinScore = noRiskReasons ? Math.min ( minScore, 0.4 ) : minScore
    const scoreOk = score >= effectiveMinScore

    if ( !valid || !actionMatches || !scoreOk ) {
      console.warn (
        "reCAPTCHA validation failed:",
        {
          valid,
          score,
          minScore,
          effectiveMinScore,
          noRiskReasons,
          invalidReason: data.tokenProperties?.invalidReason,
          hostname: data.tokenProperties?.hostname,
          action: tokenAction,
          expectedAction,
          actionMatches,
          reasons,
          reasonDescriptions,
          extendedVerdictReasons,
          assessedIp: context.userIpAddress || null,
          projectId,
          siteKeyPrefix: `${siteKey.slice ( 0, 10 )}…`
        }
      )
      throw new Error ( "reCAPTCHA validation failed or score too low." )
    }
  }
}
