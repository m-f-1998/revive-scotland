import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from "@angular/router"
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideToastr } from "ngx-toastr"
import { provideAnimations } from "@angular/platform-browser/animations"
import { ReactiveFormsModule } from "@angular/forms"
import { FormlyModule } from "@ngx-formly/core"
import { FormlyBootstrapModule } from "@ngx-formly/bootstrap"
import { AdminService } from '@services/AdminService.service';
import { FormlyLink } from './admin/components/formly-fields/formly-link.component';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection ( { eventCoalescing: true } ),
    provideRouter ( routes ),
    provideHttpClient ( ),
    provideAnimations ( ),
    provideToastr ( {
      positionClass: 'toast-bottom-right',
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
          { name: 'formly-link', component: FormlyLink }
        ]
      } ),
      FormlyBootstrapModule
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: (adminSvc: AdminService) => () => adminSvc.resumeSession ( ),
      deps: [
        AdminService
      ],
      multi: true
    }
  ]
};

