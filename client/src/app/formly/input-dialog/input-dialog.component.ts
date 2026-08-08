import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input, OnDestroy, OnInit, signal } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { DialogRef } from "@angular/cdk/dialog"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { RecaptchaV3Module, ReCaptchaV3Service } from "ng-recaptcha-2"
import { firstValueFrom, Subscription } from "rxjs"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { IconComponent } from "../../icon/icon.component"
import { RecaptchaAction, RecaptchaActionName } from "../../shared/recaptcha-actions"

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
  public body = input ( "" )
  public title = input ( "" )
  public confirmText = input ( "Confirm" )
  public cancelText = input ( "Cancel" )
  public fields = input<FormlyFieldConfig [ ]> ( [ ] )
  public model = input<T> ( { } as T )
  public recaptchaActive = input ( false )
  /** Enterprise action name — must match server expectedAction for the same flow. */
  public recaptchaAction = input<RecaptchaActionName> ( RecaptchaAction.contactSubmit )

  public captchaToken: string | null = null
  public submitting = signal ( false )

  public form = new FormGroup ( { } )
  public formValid = signal ( false )
  public description = ""

  private readonly dialogRef: DialogRef = inject ( DialogRef )
  private readonly recaptchaSvc: ReCaptchaV3Service = inject ( ReCaptchaV3Service )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly cdr: ChangeDetectorRef = inject ( ChangeDetectorRef )

  private formStatusSub: Subscription | null = null

  public ngOnInit ( ) {
    this.formValid.set ( this.form.valid )
    this.formStatusSub = this.form.statusChanges.subscribe ( ( ) => {
      this.formValid.set ( this.form.valid )
      this.cdr.markForCheck ( )
    } )
  }

  public ngOnDestroy ( ) {
    this.formStatusSub?.unsubscribe ( )
  }

  public close ( ) {
    this.dialogRef.close ( )
  }

  public async confirm ( ) {
    if ( this.form.invalid || this.submitting ( ) ) {
      return
    }

    if ( this.recaptchaActive ( ) ) {
      this.submitting.set ( true )
      this.cdr.markForCheck ( )
      try {
        this.captchaToken = await firstValueFrom (
          this.recaptchaSvc.execute ( this.recaptchaAction ( ) )
        )
      } catch {
        this.toastrSvc.error ( "Failed to load reCAPTCHA. Please try again later." )
        this.submitting.set ( false )
        this.cdr.markForCheck ( )
        return
      }
      this.submitting.set ( false )
    }

    this.dialogRef.close ( this.model ( ) )
  }
}
