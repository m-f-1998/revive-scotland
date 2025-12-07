import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, inject } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { IconService } from "../../services/icons.service"
import { RecaptchaV3Module, ReCaptchaV3Service } from "ng-recaptcha-2"
import { Subscription } from "rxjs"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Component ( {
  selector: "iqx-input-dialog",
  imports: [
    FormlyForm,
    FaIconComponent,
    RecaptchaV3Module
  ],
  templateUrl: "./input-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class InputDialogComponent implements OnInit, OnDestroy {
  @Input ( ) public body = ""
  @Input ( ) public title = ""
  @Input ( ) public confirmText = "Confirm"
  @Input ( ) public cancelText = "Cancel"
  @Input ( ) public fields: FormlyFieldConfig [ ] = [ ]
  @Input ( ) public model: any = { }
  @Input ( ) public recaptchaActive = false

  public captchaToken: string | null = null

  public form = new FormGroup ( { } )
  public description = ""

  public readonly iconSvc: IconService = inject ( IconService )
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