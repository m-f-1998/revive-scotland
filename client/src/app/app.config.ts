import { ApplicationConfig, importProvidersFrom, provideExperimentalZonelessChangeDetection } from "@angular/core"
import { provideRouter } from "@angular/router"
import { routes } from "./app.routes"
import { provideHttpClient } from "@angular/common/http"
import { provideAnimations } from "@angular/platform-browser/animations"
import { FormlyBootstrapModule } from "@ngx-formly/bootstrap"

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection ( ),
    provideRouter ( routes ),
    provideHttpClient ( ),
    provideAnimations ( ),
    importProvidersFrom (
      FormlyBootstrapModule
    )
  ]
}

