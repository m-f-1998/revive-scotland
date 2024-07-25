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
    } ),
    importProvidersFrom (
      ReactiveFormsModule,
      FormlyModule.forRoot ( ),
      FormlyBootstrapModule
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: (adminSvc: AdminService) => () => adminSvc.resumeSession(),
      deps: [
        AdminService
      ],
      multi: true
    }
  ]
};

