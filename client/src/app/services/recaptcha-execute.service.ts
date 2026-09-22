import { inject, Service } from "@angular/core"
import { ReCaptchaV3Service } from "ng-recaptcha-2"
import { firstValueFrom } from "rxjs"
import { RecaptchaActionName } from "../shared/recaptcha-actions"

const sleep = ( ms: number ): Promise<void> =>
  new Promise ( resolve => setTimeout ( resolve, ms ) )

@Service ( )
export class RecaptchaExecuteService {
  /** Valid Enterprise tokens are typically ~1700 chars; BROWSER_ERROR stubs are ~500. */
  private static readonly minTokenLength = 800
  private static readonly maxAttempts = 3
  private static readonly retryDelayMs = 400
  /** ng-recaptcha waits forever if api.js is blocked — cap each attempt. */
  private static readonly executeTimeoutMs = 8000

  private readonly recaptchaSvc: ReCaptchaV3Service = inject ( ReCaptchaV3Service )

  public async execute ( action: RecaptchaActionName ): Promise<string> {
    let lastError: unknown

    for ( let attempt = 1; attempt <= RecaptchaExecuteService.maxAttempts; attempt++ ) {
      try {
        const token = await this.executeOnce ( action )
        if ( token.length >= RecaptchaExecuteService.minTokenLength ) {
          return token
        }
        lastError = new Error ( "reCAPTCHA returned an incomplete token" )
      } catch ( err ) {
        lastError = err
      }

      if ( attempt < RecaptchaExecuteService.maxAttempts ) {
        await sleep ( RecaptchaExecuteService.retryDelayMs * attempt )
      }
    }

    throw lastError
  }

  private executeOnce ( action: RecaptchaActionName ): Promise<string> {
    return Promise.race ( [
      firstValueFrom ( this.recaptchaSvc.execute ( action ) ),
      sleep ( RecaptchaExecuteService.executeTimeoutMs ).then ( ( ) => {
        throw new Error ( "reCAPTCHA timed out" )
      } )
    ] )
  }
}
