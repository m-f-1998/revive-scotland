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
  public readonly pastEvents: WritableSignal<Array<ReviveEvent>> = signal ( [ ] )
  public readonly showArchive: WritableSignal<boolean> = signal ( false )
  public readonly loading: WritableSignal<boolean> = signal ( true )
  public readonly loadingArchive: WritableSignal<boolean> = signal ( false )
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

  public downloadIcs ( event: ReviveEvent ): void {
    const pad = ( n: number ) => String ( n ).padStart ( 2, "0" )
    const toUtcStamp = ( d: Date ) =>
      `${d.getUTCFullYear ( )}${pad ( d.getUTCMonth ( ) + 1 )}${pad ( d.getUTCDate ( ) )}T${pad ( d.getUTCHours ( ) )}${pad ( d.getUTCMinutes ( ) )}00Z`

    const start = new Date ( event.startDate )
    const end = new Date ( event.endDate )
    if ( event.startTime ) {
      const [ h, m ] = event.startTime.split ( ":" ).map ( Number )
      start.setHours ( h || 0, m || 0, 0, 0 )
    }
    if ( event.endTime ) {
      const [ h, m ] = event.endTime.split ( ":" ).map ( Number )
      end.setHours ( h || 0, m || 0, 0, 0 )
    } else if ( end.getTime ( ) <= start.getTime ( ) ) {
      end.setTime ( start.getTime ( ) + 2 * 60 * 60 * 1000 )
    }

    const escape = ( s: string ) => s.replace ( /\\/g, "\\\\" ).replace ( /;/g, "\\;" ).replace ( /,/g, "\\," ).replace ( /\n/g, "\\n" )
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Revive Scotland//Events//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${event.id}@revivescotland.co.uk`,
      `DTSTAMP:${toUtcStamp ( new Date ( ) )}`,
      `DTSTART:${toUtcStamp ( start )}`,
      `DTEND:${toUtcStamp ( end )}`,
      `SUMMARY:${escape ( event.title )}`,
      `DESCRIPTION:${escape ( event.description || "" )}`,
      `LOCATION:${escape ( event.location || "" )}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join ( "\r\n" )

    const blob = new Blob ( [ ics ], { type: "text/calendar;charset=utf-8" } )
    const url = URL.createObjectURL ( blob )
    const a = document.createElement ( "a" )
    a.href = url
    a.download = `${event.title.replace ( /[^\w]+/g, "-" ).toLowerCase ( ) || "event"}.ics`
    a.click ( )
    URL.revokeObjectURL ( url )
  }

  public async toggleArchive ( ): Promise<void> {
    const next = !this.showArchive ( )
    this.showArchive.set ( next )
    if ( next && this.pastEvents ( ).length === 0 ) {
      this.loadingArchive.set ( true )
      try {
        const res = await this.apiSvc.get ( "/api/events/archive" ) as { events: ReviveEvent [ ] }
        this.pastEvents.set ( res.events || [ ] )
      } catch ( e ) {
        if ( isDevMode ( ) ) console.error ( e )
        this.toastrSvc.error ( "Could not load past events." )
      } finally {
        this.loadingArchive.set ( false )
      }
    }
  }

  public async openContactForm ( event: ReviveEvent ) {
    if ( event.isFull && !event.waitlistOpen && event.donationRequired === "required" ) {
      this.toastrSvc.error ( "This event is fully booked." )
      return
    }

    const needsPayment = event.donationRequired === "required"
    const waitlistOnly = !!event.isFull && !!event.waitlistOpen
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.setInput ( "title", waitlistOnly ? `Join waitlist — ${event.title}` : `Register for ${event.title}` )
    modalRef.setInput (
      "body",
      waitlistOnly
        ? `This event is full. You can join the waitlist for "${event.title}". We'll contact you if a place opens.`
        : needsPayment
          ? `Please fill out the form below. You'll be taken to Stripe to pay — your registration is only confirmed after payment succeeds.`
          : `Please fill out the form below to register for "${event.title}". You won't receive a separate confirmation email.`
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
          } ) as { message: string; checkoutUrl?: string; donateLaterUrl?: string; draftId?: string; cancelToken?: string }

          if ( res.checkoutUrl ) {
            if ( res.draftId ) {
              sessionStorage.setItem ( "checkoutDraftId", res.draftId )
              sessionStorage.setItem ( "checkoutUrl", res.checkoutUrl )
              sessionStorage.setItem ( "checkoutEventTitle", event.title )
              if ( res.cancelToken ) {
                sessionStorage.setItem ( "checkoutCancelToken", res.cancelToken )
              }
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
            successRef.setInput ( "status", ( res as { status?: string } ).status === "waitlist" ? "waitlist" : "completed" )
            void this.getEvents ( true )
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

    if ( event.donationRequired === "optional" && !event.isFull ) {
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
        void this.showRegistrationSuccess ( draftId, title )
        sessionStorage.removeItem ( "checkoutDraftId" )
        sessionStorage.removeItem ( "checkoutCancelToken" )
        sessionStorage.removeItem ( "checkoutUrl" )
        sessionStorage.removeItem ( "checkoutEventTitle" )
        this.clearQueryParams ( )
      } else if ( status === "cancelled" ) {
        const cachedUrl = sessionStorage.getItem ( "checkoutUrl" )
        if ( cachedUrl ) {
          this.resumePaymentUrl.set ( cachedUrl )
        }
        void this.sendPaymentPromptAfterCancel ( draftId )
        sessionStorage.removeItem ( "checkoutDraftId" )
        sessionStorage.removeItem ( "checkoutCancelToken" )
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

  private async showRegistrationSuccess ( draftId: string | undefined, title: string ): Promise<void> {
    if ( draftId ) {
      try {
        const res = await this.apiSvc.get ( `/api/events/checkout-draft/${draftId}/status` ) as { status?: string }
        if ( res?.status === "pending" ) {
          const warnRef = this.modalSvc.open ( ErrorModalComponent, { centered: true } )
          warnRef.setInput ( "title", "Payment Processing" )
          warnRef.setInput ( "message", "Your payment is still being confirmed. You'll receive confirmation shortly — if not, contact us with your receipt." )
          warnRef.setInput ( "type", "warning" )
          return
        }
        if ( res?.status === "not_found" ) {
          const errRef = this.modalSvc.open ( ErrorModalComponent, { centered: true } )
          errRef.setInput ( "title", "Registration Not Found" )
          errRef.setInput ( "message", "We couldn't confirm your registration yet. If you were charged, contact us with your Stripe receipt and we'll sort it out." )
          errRef.setInput ( "type", "warning" )
          return
        }
        if ( res?.status !== "paid" ) {
          return
        }
      } catch {
        // Fall through to success if status check fails (webhook may already have completed)
      }
    }

    const successRef = this.modalSvc.open ( SuccessModalComponent, { centered: true } )
    successRef.setInput ( "eventTitle", title )
  }

  private async sendPaymentPromptAfterCancel ( draftId: string | undefined ): Promise<void> {
    const cancelToken = sessionStorage.getItem ( "checkoutCancelToken" ) || undefined
    if ( !draftId || !cancelToken ) return
    try {
      const res = await this.apiSvc.post ( `/api/events/checkout-draft/${draftId}/discard`, { cancelToken } ) as { hostedInvoiceUrl?: string | null }
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

  private async getEvents ( force = false ) {
    try {
      this.events.set ( await this.eventsSvc.getEvents ( force ) )
    } catch ( e ) {
      if ( isDevMode ( ) ) {
        console.error ( e )
      }
    } finally {
      this.loading.set ( false )
    }
  }
}
