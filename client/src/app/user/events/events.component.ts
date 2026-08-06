import { ChangeDetectionStrategy, Component, inject, isDevMode, OnInit, signal, WritableSignal } from "@angular/core"
import { HttpErrorResponse } from "@angular/common/http"
import { ActivatedRoute, Router } from "@angular/router"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { FooterComponent } from "@components/footer/footer.component"
import { DatesService } from "@services/dates.service"
import { EventsService, ReviveEvent } from "@services/events.service"
import { ContactComponent } from "@components/contact/contact.component"
import { SliderComponent } from "@components/slider/slider.component"
import { FormlyService } from "../../services/formly.service"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { ModalService } from "@app/services/modal.service"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { ApiService } from "../../services/api.service"
import { IconComponent } from "../../icon/icon.component"
import { getDefaultRegistrationFields } from "./registration-form.defaults"
import { SuccessModalComponent } from "./success-modal/success-modal.component"
import { ErrorModalComponent } from "./error-modal/error-modal.component"

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    IconComponent,
    ContactComponent,
    SliderComponent,
    NavbarComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventsComponent implements OnInit {
  public slides = [
    {
      title: "Upcoming Events",
      content: "Revive Scotland",
      image: "gallery/skye/skye-1.jpg"
    },
    {
      title: "Upcoming Events",
      content: "Revive Scotland",
      image: "gallery/skye/skye-3.jpg"
    },
  ]

  public readonly events: WritableSignal<Array<ReviveEvent>> = signal ( [ ] )
  public readonly loading: WritableSignal<boolean> = signal ( true )
  public readonly resumePaymentUrl: WritableSignal<string | null> = signal ( null )

  public readonly eventsSvc: EventsService = inject ( EventsService )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly route: ActivatedRoute = inject ( ActivatedRoute )
  private readonly router: Router = inject ( Router )

  public ngOnInit ( ) {
    this.getEvents ( ).then ( ( ) => this.checkQueryParameters ( ) )
  }

  public openPoster ( imageUrl: string ) {
    window.open ( imageUrl, "_blank" )
  }

  public getGoogleMapsUrl ( location: string ): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent ( location )}`
  }

  public async openContactForm ( event: ReviveEvent ) {
    const needsPayment = event.donationRequired === "required"
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.setInput ( "title", `Register for ${event.title}` )
    modalRef.setInput (
      "body",
      needsPayment
        ? `Please fill out the form below. You'll be taken to Stripe to pay — your registration is only confirmed after payment succeeds.`
        : `Please fill out the form below to register for "${event.title}".`
    )
    modalRef.setInput (
      "confirmText",
      needsPayment ? "Proceed to Payment" : "Submit"
    )
    modalRef.setInput ( "recaptchaActive", true )

    const fields = this.buildRegistrationFields ( event )
    modalRef.setInput ( "fields", fields )

    await modalRef.result.then ( async ( result: Record<string, unknown> ) => {
      if ( result ) {
        if ( !modalRef.componentInstance.captchaToken ) {
          console.error ( "No reCAPTCHA token available." )
          return
        }

        this.loading.set ( true )
        try {
          const res = await this.apiSvc.post ( `/api/events/${event.id}/register`, {
            ...result,
            recaptchaToken: modalRef.componentInstance.captchaToken
          } ) as { message: string; checkoutUrl?: string; donateLaterUrl?: string; draftId?: string }

          if ( res.checkoutUrl ) {
            if ( res.draftId ) {
              sessionStorage.setItem ( "checkoutDraftId", res.draftId )
              sessionStorage.setItem ( "checkoutUrl", res.checkoutUrl )
              sessionStorage.setItem ( "checkoutEventTitle", event.title )
            }
            this.toastrSvc.info (
              "Taking you to Stripe. Your registration is not saved until payment is completed.",
              "Payment required",
              { timeOut: 6000 }
            )
            await new Promise ( resolve => setTimeout ( resolve, 900 ) )
            window.location.href = res.checkoutUrl
          } else {
            const successRef = this.modalSvc.open ( SuccessModalComponent, {
              centered: true
            } )
            successRef.setInput ( "eventTitle", event.title )
          }
        } catch ( e ) {
          if ( isDevMode ( ) ) {
            console.error ( e )
          }
          const apiMessage = e instanceof HttpErrorResponse
            ? ( typeof e.error === "string" ? e.error : e.error?.message )
            : undefined
            
          const errorRef = this.modalSvc.open ( ErrorModalComponent, {
            centered: true
          } )
          errorRef.setInput ( "title", "Registration Error" )
          errorRef.setInput ( "message", apiMessage || "An error occurred while submitting your registration. Please try again later." )
          errorRef.setInput ( "type", "error" )
        } finally {
          this.loading.set ( false )
        }
      }
    } ).catch ( ( ) => { } )
  }

  /**
   * Ensure Name, Email, and Phone are always present on the public form.
   * Events saved before defaults existed may only have custom fields.
   */
  private buildRegistrationFields ( event: ReviveEvent ): FormlyFieldConfig [ ] {
    const existing = [ ...( event.contactFormFields || [ ] ) ]
    const keys = new Set (
      existing.map ( f => String ( f.key || "" ).toLowerCase ( ) )
    )

    const defaults = getDefaultRegistrationFields ( this.formlySvc )
    const missing = defaults.filter ( field => !keys.has ( String ( field.key || "" ).toLowerCase ( ) ) )
    const fields = [ ...missing, ...existing ]

    if ( event.donationRequired === "optional" ) {
      fields.push ( this.formlySvc.CheckboxInput ( "optInDonation", {
        label: `Include an optional donation?`
      }, {
        className: "block mb-4"
      } ) )
      fields.push ( {
        key: "customDonationAmount",
        type: "input",
        defaultValue: ( event.donationPrice || 0 ) / 100,
        className: "block mb-4",
        props: {
          label: "Donation Amount (£)",
          type: "number",
          placeholder: ( ( event.donationPrice || 0 ) / 100 ).toFixed ( 2 ),
          required: true,
          min: 0.50,
          step: 0.01
        },
        expressions: {
          hide: ( formlyField: FormlyFieldConfig ) => !formlyField.model?.optInDonation
        }
      } )
    }

    return fields
  }

  private checkQueryParameters ( ): void {
    this.route.queryParams.subscribe ( params => {
      const status = params [ "registration" ]
      const draftId = ( params [ "draftId" ] as string | undefined )
        || sessionStorage.getItem ( "checkoutDraftId" )
        || undefined

      if ( status === "success" ) {
        const title = sessionStorage.getItem ( "checkoutEventTitle" ) || ""
        sessionStorage.removeItem ( "checkoutDraftId" )
        sessionStorage.removeItem ( "checkoutUrl" )
        sessionStorage.removeItem ( "checkoutEventTitle" )
        
        const successRef = this.modalSvc.open ( SuccessModalComponent, {
          centered: true
        } )
        successRef.setInput ( "eventTitle", title )

        this.clearQueryParams ( )
      } else if ( status === "cancelled" ) {
        const cachedUrl = sessionStorage.getItem ( "checkoutUrl" )
        if ( cachedUrl ) {
          this.resumePaymentUrl.set ( cachedUrl )
        }
        void this.sendPaymentPromptAfterCancel ( draftId )
        sessionStorage.removeItem ( "checkoutDraftId" )
        sessionStorage.removeItem ( "checkoutUrl" )
        sessionStorage.removeItem ( "checkoutEventTitle" )
        
        const errorRef = this.modalSvc.open ( ErrorModalComponent, {
          centered: true
        } )
        errorRef.setInput ( "title", "Payment Cancelled" )
        errorRef.setInput ( "message", "Registration failed to complete or was cancelled. Please try again or contact us if you need assistance." )
        errorRef.setInput ( "type", "warning" )
        
        this.clearQueryParams ( )
      }
    } )
  }

  private async sendPaymentPromptAfterCancel ( draftId: string | undefined ): Promise<void> {
    if ( !draftId ) return
    try {
      const res = await this.apiSvc.post ( `/api/events/checkout-draft/${draftId}/discard`, { } ) as { hostedInvoiceUrl?: string | null }
      if ( res?.hostedInvoiceUrl ) {
        this.resumePaymentUrl.set ( res.hostedInvoiceUrl )
      }
    } catch ( e ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Failed to send payment-prompt email after cancel:", e )
      }
    }
  }

  private clearQueryParams ( ): void {
    this.router.navigate ( [ ], {
      relativeTo: this.route,
      queryParams: { registration: null, eventId: null, draftId: null },
      queryParamsHandling: "merge"
    } )
  }

  private async getEvents ( ) {
    try {
      this.events.set ( await this.eventsSvc.getEvents ( ) )
    } catch ( e ) {
      if ( isDevMode ( ) ) {
        console.error ( e )
      }
    } finally {
      this.loading.set ( false )
    }
  }
}
