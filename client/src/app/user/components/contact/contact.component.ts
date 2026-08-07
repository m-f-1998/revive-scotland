import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { HttpErrorResponse } from "@angular/common/http"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { IconComponent } from "@app/icon/icon.component"
import { ApiService } from "@app/services/api.service"
import { FormlyService } from "@app/services/formly.service"
import { ModalService } from "@app/services/modal.service"
import { InputDialogComponent } from "@app/formly/input-dialog/input-dialog.component"

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
  imports: [ IconComponent ],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactComponent implements OnInit {
  public details: WritableSignal<ContactDetails> = signal ( FALLBACK )
  public sending: WritableSignal<boolean> = signal ( false )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/content/contact-details" ).then ( data => {
      this.details.set ( data as ContactDetails )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }

  public async openMessageForm ( ): Promise<void> {
    if ( this.sending ( ) ) return

    const modalRef = this.modalSvc.open ( InputDialogComponent, { centered: true } )
    modalRef.setInput ( "title", "Send a message" )
    modalRef.setInput (
      "body",
      "We'll get back to you by email as soon as possible."
    )
    modalRef.setInput ( "confirmText", "Send" )
    modalRef.setInput ( "recaptchaActive", true )
    modalRef.setInput ( "fields", [
      this.formlySvc.TextInput ( "name", {
        label: "Your name",
        required: true,
        maxLength: 120
      } ),
      this.formlySvc.EmailInput ( "email", {
        label: "Email",
        placeholder: "you@example.com",
        required: true,
        maxLength: 200
      } ),
      this.formlySvc.TextAreaInput ( "message", {
        label: "Message",
        required: true,
        maxLength: 2000
      } )
    ] )

    try {
      const result = await modalRef.result as Record<string, unknown>
      if ( !result || typeof result !== "object" ) return

      if ( !modalRef.componentInstance.captchaToken ) {
        this.toastrSvc.error ( "reCAPTCHA was not ready. Please try again." )
        return
      }

      this.sending.set ( true )
      await this.apiSvc.post ( "/api/contact", {
        ...result,
        recaptchaToken: modalRef.componentInstance.captchaToken
      } )
      this.toastrSvc.success ( "Thanks — your message has been sent." )
    } catch ( e ) {
      // ModalRef rejects with "dismissed" when closed without confirming
      if ( e === "dismissed" || e === undefined || e === null ) return
      const msg = e instanceof HttpErrorResponse
        ? ( typeof e.error === "object" && e.error?.message ? String ( e.error.message ) : undefined )
        : undefined
      this.toastrSvc.error ( msg || "Could not send your message. Please try email instead." )
    } finally {
      this.sending.set ( false )
    }
  }
}
