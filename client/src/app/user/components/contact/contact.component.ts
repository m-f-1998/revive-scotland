import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { FormGroup, ReactiveFormsModule } from "@angular/forms"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { RecaptchaV3Module, ReCaptchaV3Service } from "ng-recaptcha-2"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { IconComponent } from "@app/icon/icon.component"
import { ApiService } from "@app/services/api.service"
import { FormlyService } from "@app/services/formly.service"
import { HttpErrorResponse } from "@angular/common/http"

interface ContactDetails {
  phone: string
  email: string
  instagram: string
}

const FALLBACK: ContactDetails = {
  phone: "+447883824055",
  email: "luca@revivescotland.co.uk",
  instagram: "revive.scotland"
}

@Component ( {
  selector: "app-contact",
  imports: [ IconComponent, FormlyForm, ReactiveFormsModule, RecaptchaV3Module ],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactComponent implements OnInit {
  public details: WritableSignal<ContactDetails> = signal ( FALLBACK )
  public sending: WritableSignal<boolean> = signal ( false )
  public sent: WritableSignal<boolean> = signal ( false )

  public form = new FormGroup ( { } )
  public model: Record<string, unknown> = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly recaptchaSvc: ReCaptchaV3Service = inject ( ReCaptchaV3Service )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.fields = [
      this.formlySvc.TextInput ( "name", {
        label: "Your name",
        required: true,
        maxLength: 120
      } ),
      this.formlySvc.TextInput ( "email", {
        label: "Email",
        type: "email",
        required: true,
        maxLength: 200
      } ),
      this.formlySvc.TextAreaInput ( "message", {
        label: "Message",
        required: true,
        maxLength: 2000
      } )
    ]

    this.apiSvc.get ( "/api/content/contact-details" ).then ( data => {
      this.details.set ( data as ContactDetails )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }

  public async submitInquiry ( ): Promise<void> {
    if ( this.form.invalid || this.sending ( ) ) {
      this.form.markAllAsTouched ( )
      return
    }

    this.sending.set ( true )
    try {
      const recaptchaToken = await new Promise<string> ( ( resolve, reject ) => {
        this.recaptchaSvc.execute ( "contactForm" ).subscribe ( {
          next: resolve,
          error: reject
        } )
      } )

      await this.apiSvc.post ( "/api/contact", {
        ...this.model,
        recaptchaToken
      } )

      this.sent.set ( true )
      this.model = { }
      this.form.reset ( )
      this.toastrSvc.success ( "Thanks — your message has been sent." )
    } catch ( e ) {
      const msg = e instanceof HttpErrorResponse
        ? ( typeof e.error === "object" && e.error?.message ? String ( e.error.message ) : undefined )
        : undefined
      this.toastrSvc.error ( msg || "Could not send your message. Please try email instead." )
    } finally {
      this.sending.set ( false )
    }
  }
}
