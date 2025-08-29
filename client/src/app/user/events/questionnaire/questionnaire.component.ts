import { ChangeDetectionStrategy, Component, inject, Input, OnDestroy, OnInit, signal, WritableSignal } from "@angular/core"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormGroup, ReactiveFormsModule } from "@angular/forms"
import { FormlyForm } from "@ngx-formly/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { RecaptchaV3Module, ReCaptchaV3Service } from "ng-recaptcha-2"
import { Subscription } from "rxjs"
import { ApiService } from "@revive/src/app/services/api.service"
import { Questionnaire } from "../events.component"
import { IconService } from "@revive/src/app/services/icons.service"

@Component ( {
  selector: "app-questionnaire",
  imports: [
    FormlyForm,
    ReactiveFormsModule,
    FaIconComponent,
    RecaptchaV3Module
  ],
  templateUrl: "./questionnaire.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class QuestionnaireComponent implements OnInit, OnDestroy {
  @Input ( ) public title: string = ""
  @Input ( ) public event: Questionnaire | undefined

  public loading: WritableSignal<boolean> = signal ( false )

  public form: FormGroup = new FormGroup ( { } )
  public model: any = { }

  public captchaToken: string | null = null

  public readonly iconSvc: IconService = inject ( IconService )

  private subscription: Subscription | null = null

  private readonly activeModal: NgbActiveModal = inject ( NgbActiveModal )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly recaptchaSvc: ReCaptchaV3Service = inject ( ReCaptchaV3Service )
  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ) {
    if ( !this.event ) {
      this.toastrSvc.error ( "Event not found" )
      this.activeModal.close ( )
      return
    }

    this.title = this.event.title
    this.subscription = this.recaptchaSvc.execute ( "contactForm" ).subscribe ( {
      next: ( token: string ) => {
        this.captchaToken = token
      },
      error: ( ) => {
        this.toastrSvc.error ( "reCAPTCHA invalid" )
        this.activeModal.close ( )
      }
    } )
  }

  public ngOnDestroy ( ) {
    if ( this.subscription ) {
      this.subscription.unsubscribe ( )
    }
  }

  public close ( ) {
    this.activeModal.close ( )
  }

  public async submit ( ) {
    if ( this.form.invalid ) {
      this.toastrSvc.error ( "Please complete all required fields" )
      return
    }

    if ( !this.captchaToken ) {
      this.toastrSvc.error ( "reCAPTCHA invalid" )
      return
    }

    const message = `Name: ${this.form.value.name}\n\nEmail: ${this.form.value.email}\n\nQuestions:\n"${this.form.value.questions}"\n\nAre you interested in going? ${this.form.value.interest ? "Yes" : "No"}`
    this.loading.set ( true )

    try {
      await this.apiSvc.post ( "/api/mail", {
        subject: this.event!.title,
        message: message,
        recaptchaToken: this.captchaToken
      } )
      this.toastrSvc.success ( "Thank you for your interest, we will be in touch soon!", "Message Sent" )
    } catch ( e: any ) {
      this.toastrSvc.error ( e.message ?? "An Unexpected Error Occured", "Please Try Again Later" )
      console.error ( e )
    } finally {
      this.loading.set ( false )
      this.form.reset ( )
      this.activeModal.close ( )
    }
  }
}