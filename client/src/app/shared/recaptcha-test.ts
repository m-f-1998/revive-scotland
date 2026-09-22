import { Router } from "@angular/router"
import { ToastrService } from "@m-f-1998/ngx-toastr"

/** Server-side simulated failures — token must match server `recaptchaTestToken()`. */
export type RecaptchaServerTestMode =
  | "browser-error"
  | "invalid-token"
  | "action-mismatch"
  | "score-too-low"
  | "http-failed"
  | "not-configured"

/** Client-only: input-dialog toast, never reaches the server. */
export type RecaptchaClientTestMode = "client-fail"

export type RecaptchaTestMode = RecaptchaServerTestMode | RecaptchaClientTestMode

export const RECAPTCHA_TEST_MODES: RecaptchaTestMode [ ] = [
  "browser-error",
  "invalid-token",
  "action-mismatch",
  "score-too-low",
  "http-failed",
  "not-configured",
  "client-fail"
]

const SESSION_KEY = "recaptchaTest"

export const isRecaptchaTestHost = ( ): boolean => {
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "dev.revivescotland.co.uk"
}

export const isRecaptchaTestMode = ( value: string ): value is RecaptchaTestMode => {
  return ( RECAPTCHA_TEST_MODES as string [ ] ).includes ( value )
}

export const getRecaptchaTestMode = ( ): RecaptchaTestMode | null => {
  if ( !isRecaptchaTestHost ( ) ) {
    return null
  }
  const stored = sessionStorage.getItem ( SESSION_KEY )
  return stored && isRecaptchaTestMode ( stored ) ? stored : null
}

export const setRecaptchaTestMode = ( mode: RecaptchaTestMode | "off" ): void => {
  if ( !isRecaptchaTestHost ( ) ) {
    return
  }
  if ( mode === "off" ) {
    sessionStorage.removeItem ( SESSION_KEY )
  } else {
    sessionStorage.setItem ( SESSION_KEY, mode )
  }
}

export const recaptchaTestToken = ( mode: RecaptchaServerTestMode ): string => {
  return `__recaptcha_test_${mode.replace ( /-/g, "_" )}__`
}

export const isServerRecaptchaTestMode = (
  mode: RecaptchaTestMode | null
): mode is RecaptchaServerTestMode => {
  return mode != null && mode !== "client-fail"
}

const TEST_MODE_LABELS: Record<RecaptchaTestMode, string> = {
  "browser-error": "BROWSER_ERROR (retryable warning)",
  "invalid-token": "INVALID_TOKEN (retryable)",
  "action-mismatch": "ACTION_MISMATCH (retryable)",
  "score-too-low": "SCORE_TOO_LOW (not retryable)",
  "http-failed": "HTTP_FAILED (retryable)",
  "not-configured": "NOT_CONFIGURED",
  "client-fail": "Client execute failure (toast only)"
}

/** Read `?recaptchaTest=` from any route; persists in sessionStorage. */
export const applyRecaptchaTestFromUrl = ( router: Router, toastr: ToastrService ): void => {
  if ( !isRecaptchaTestHost ( ) ) {
    return
  }

  const tree = router.parseUrl ( router.url )
  const raw = tree.queryParams [ "recaptchaTest" ]
  if ( raw == null || raw === "" ) {
    return
  }

  if ( raw === "off" ) {
    setRecaptchaTestMode ( "off" )
    toastr.info ( "reCAPTCHA test mode turned off.", undefined, { timeOut: 4000 } )
  } else if ( isRecaptchaTestMode ( raw ) ) {
    setRecaptchaTestMode ( raw )
    toastr.info (
      `Submit a form to preview: ${TEST_MODE_LABELS [ raw ]}`,
      "reCAPTCHA test mode on",
      { timeOut: 9000 }
    )
  } else {
    toastr.warning (
      `Unknown recaptchaTest value "${raw}". Try: ${RECAPTCHA_TEST_MODES.join ( ", " )}, off`,
      undefined,
      { timeOut: 10000 }
    )
  }

  delete tree.queryParams [ "recaptchaTest" ]
  void router.navigateByUrl ( tree, { replaceUrl: true } )
}
