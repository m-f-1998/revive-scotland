import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection, inject, provideAppInitializer } from "@angular/core"
import { provideRouter } from "@angular/router"
import { routes } from "./app.routes"
import { provideHttpClient } from "@angular/common/http"
import { provideToastr } from "ngx-toastr"
import { provideAnimations } from "@angular/platform-browser/animations"
import { ReactiveFormsModule } from "@angular/forms"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { FormlyBootstrapModule } from "@ngx-formly/bootstrap"
import { AdminService } from "@services/AdminService.service"
import { FormlyLinkComponent } from "./admin/components/formly-fields/formly-link.component"
import { ValidEmail } from "./validators/EmailAddress.validator"
import { ValidPhoneNumber } from "./validators/PhoneNumber.validator"

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
      ReactiveFormsModule,
      FormlyModule.forRoot ( {
        types: [
          { name: "formly-link", component: FormlyLinkComponent }
        ],
        validationMessages: [
          { name: "minLength", message: ( error: any, field: FormlyFieldConfig ) => {
            return `Should have a minimum of ${field.props?.minLength} characters.`
          } },
          { name: "maxLength", message: ( error: any, field: FormlyFieldConfig ) => {
            return `Should have a maximum of ${field.props?.maxLength} characters.`
          } },
        ],
        validators: [
          { name: "ValidEmail", validation: ValidEmail },
          { name: "ValidPhone", validation: ValidPhoneNumber }
        ]
      } ),
      FormlyBootstrapModule
    ),
    provideAppInitializer ( () => {
      const initializerFn = ( ( adminSvc: AdminService ) => () => adminSvc.resumeSession ( ) ) ( inject ( AdminService ) )
      return initializerFn ()
    } )
  ]
}

