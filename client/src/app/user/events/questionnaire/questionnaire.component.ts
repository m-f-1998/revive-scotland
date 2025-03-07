import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, signal, WritableSignal } from "@angular/core"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"

import { ReactiveFormsModule } from "@angular/forms"
import { FormlyModule } from "@ngx-formly/core" 
import { FormlyBootstrapModule } from "@ngx-formly/bootstrap"
import { faPaperPlane, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { HttpClient } from "@angular/common/http"
import { ToastrService } from "ngx-toastr"
import { RecaptchaV3Module, ReCaptchaV3Service } from "ng-recaptcha-2"
import { Subscription } from "rxjs"

@Component ( {
  selector: "app-questionnaire",
  imports: [
    FormlyModule,
    ReactiveFormsModule,
    FormlyBootstrapModule,
    FaIconComponent,
    RecaptchaV3Module
  ],
  templateUrl: "./questionnaire.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class QuestionnaireComponent implements OnInit, OnDestroy {
  @Input ( ) public title: string = ""
  @Input ( ) public event: any = { }

  public readonly processing: WritableSignal<boolean> = signal ( false )

  public faMail = faPaperPlane
  public faSpinner = faSpinner

  public captchaToken: string | null = null
  private subscription: Subscription | null = null

  public constructor (
    private activeModal: NgbActiveModal,
    private httpSvc: HttpClient,
    private toastrSvc: ToastrService,
    private recaptchaSvc: ReCaptchaV3Service
  ) { }

  public ngOnInit ( ) {
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

  public submit ( ) {
    if ( this.event.form.invalid ) {
      this.toastrSvc.error ( "Please complete all required fields" )
      return
    }

    if ( !this.captchaToken ) {
      this.toastrSvc.error ( "reCAPTCHA invalid" )
      return
    }

    const formData = new FormData ( )
    formData.append ( "subject", `${this.event.title}` )
    const message = `Name: ${this.event.form.value.name}\n\nEmail: ${this.event.form.value.email}\n\nQuestions:\n"${this.event.form.value.questions}"\n\nAre you interested in going? ${this.event.form.value.interest ? "Yes" : "No"}`
    formData.append ( "message", message )
    formData.append ( "recaptcha-token", this.captchaToken )

    this.processing.set ( true )
    this.httpSvc.post ( "https://api.matthewfrankland.co.uk/revivescotland/mailer/", formData ).subscribe ( {
      next: ( ) => {
        this.toastrSvc.success ( "Thank you for your interest, we will be in touch soon!", "Message Sent" )
        this.event.form.reset ( )
        this.activeModal.close ( )
        this.processing.set ( false )
      },
      error: e => {
        this.activeModal.close ( )
        this.event.form.reset ( )
        this.toastrSvc.error ( e.error ?? "An Unexpected Error Occured", "Please Try Again Later" )
        console.error ( e )
        this.processing.set ( false )
      }
    } )
  }
}