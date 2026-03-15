import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, inject } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { RecaptchaV3Module, ReCaptchaV3Service } from "ng-recaptcha-2"
import { Subscription } from "rxjs"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "iqx-input-dialog",
  imports: [
    FormlyForm,
    IconComponent,
    RecaptchaV3Module
  ],
  templateUrl: "./input-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class InputDialogComponent<T extends Record<string, unknown> = Record<string, unknown>> implements OnInit, OnDestroy {
  @Input ( ) public body = ""
  @Input ( ) public title = ""
  @Input ( ) public confirmText = "Confirm"
  @Input ( ) public cancelText = "Cancel"
  @Input ( ) public fields: FormlyFieldConfig [ ] = [ ]
  @Input ( ) public model: T = { } as T
  @Input ( ) public recaptchaActive = false

  public captchaToken: string | null = null

  public form = new FormGroup ( { } )
  public description = ""

  private readonly activeModal: NgbActiveModal = inject ( NgbActiveModal )
  private readonly recaptchaSvc: ReCaptchaV3Service = inject ( ReCaptchaV3Service )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  private subscription: Subscription | null = null

  public ngOnInit ( ) {
    if ( this.recaptchaActive ) {
      this.subscription = this.recaptchaSvc.execute ( "contactForm" ).subscribe ( {
        next: ( token: string ) => {
          this.captchaToken = token
        },
        error: ( ) => {
          this.toastrSvc.error ( "Failed to load reCAPTCHA. Please try again later." )
          this.close ( )
        }
      } )
    }
  }

  public ngOnDestroy ( ) {
    if ( this.subscription ) {
      this.subscription.unsubscribe ( )
    }
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }

  public confirm ( ) {
    if ( this.form.invalid ) {
      return
    }
    this.activeModal.close ( this.model )
  }

}