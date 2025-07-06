import { ApplicationConfig, CSP_NONCE, provideZonelessChangeDetection } from "@angular/core"
import { provideRouter } from "@angular/router"
import { routes } from "./app.routes"
import { provideHttpClient } from "@angular/common/http"
import { provideAnimations } from "@angular/platform-browser/animations"
import { provideFormlyCore } from "@ngx-formly/core"
import { provideToastr } from "ngx-toastr"
import { RECAPTCHA_LOADER_OPTIONS, RECAPTCHA_V3_SITE_KEY } from "ng-recaptcha-2"
import { withFormlyBootstrap } from "@ngx-formly/bootstrap"
import { FormlyConfig } from "./formly/formly-config"

const nonce = document.querySelector ( 'meta[name="csp-nonce"]' )?.getAttribute ( "content" )

const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection ( ),
    provideRouter ( routes ),
    provideHttpClient ( ),
    provideAnimations ( ),
    provideFormlyCore ( [
      new FormlyConfig ( ),
      ...withFormlyBootstrap ( )
    ] ),
    provideToastr ( {
      positionClass: "toast-bottom-right",
      preventDuplicates: true,
      progressBar: true,
      tapToDismiss: true,
      autoDismiss: true,
      timeOut: 4000,
      extendedTimeOut: 3000
    } ),
    {
      provide: RECAPTCHA_V3_SITE_KEY,
      useValue: "6LebYqIqAAAAAPIyOGWY_YD4i55xHdhpO9tOvK5r"
    }
  ]
}

if ( nonce ) {
  appConfig.providers.push ( {
    provide: CSP_NONCE,
    useValue: nonce
  } )
  appConfig.providers.push ( {
    provide: RECAPTCHA_LOADER_OPTIONS,
    useValue: {
      onBeforeLoad ( _url: any ) {
        return {
          url: _url,
          nonce,
        }
      },
    },
  } )
}

export { appConfig }