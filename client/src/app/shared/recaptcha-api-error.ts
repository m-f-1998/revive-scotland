import { HttpErrorResponse } from "@angular/common/http"

export type RecaptchaApiError = {
  message: string
  retryable: boolean
  code?: string
}

export const parseRecaptchaApiError = ( error: unknown ): RecaptchaApiError | undefined => {
  if ( !( error instanceof HttpErrorResponse ) ) {
    return undefined
  }

  const body = error.error
  if ( typeof body === "object" && body != null && "message" in body ) {
    const message = String ( ( body as { message: unknown } ).message || "" ).trim ( )
    if ( !message ) {
      return undefined
    }

    return {
      message,
      retryable: ( body as { retryable?: unknown } ).retryable === true,
      code: ( body as { code?: unknown } ).code != null
        ? String ( ( body as { code: unknown } ).code )
        : undefined
    }
  }

  return undefined
}
