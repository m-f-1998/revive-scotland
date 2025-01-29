import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from "@angular/core"
import { provideRouter } from "@angular/router"
import { routes } from "./app.routes"
import { provideHttpClient } from "@angular/common/http"
import { provideToastr } from "ngx-toastr"
import { provideAnimations } from "@angular/platform-browser/animations"
import { FormlyBootstrapModule } from "@ngx-formly/bootstrap"

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection ( { eventCoalescing: true } ),
    provideRouter ( routes ),
    provideHttpClient ( ),
    provideAnimations ( ),
    provideToastr ( {
      positionClass: "toast-bottom-right",
      preventDuplicates: true,
      progressBar: true,
      tapToDismiss: true,
      autoDismiss: true,
      timeOut: 4000,
      extendedTimeOut: 3000
    } ),
    importProvidersFrom (
      FormlyBootstrapModule
    )
  ]
}

