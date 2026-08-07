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
import { EventDetailsModalComponent } from "./event-details-modal/event-details-modal.component"
import { downloadEventIcs, getGoogleMapsUrl } from "./event-download.utils"
import { pickRandomQuote, EvangelisationQuote } from "./evangelisation-quotes"

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
  public readonly quote: WritableSignal<EvangelisationQuote> = signal ( pickRandomQuote ( ) )
  public readonly highlightedEventId: WritableSignal<string | null> = signal ( null )

  public readonly eventsSvc: EventsService = inject ( EventsService )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly route: ActivatedRoute = inject ( ActivatedRoute )
  private readonly router: Router = inject ( Router )

  public ngOnInit ( ) {
    this.quote.set ( pickRandomQuote ( ) )
    this.getEvents ( true ).then ( ( ) => {
      void this.reconcileStoredCheckoutState ( )
      this.checkQueryParameters ( )
    } )
  }

  public openEventDetails ( event: ReviveEvent ): void {
    const modalRef = this.modalSvc.open ( EventDetailsModalComponent, {
      centered: true,
      panelClass: "modal-event-details"
    } )
    modalRef.setInput ( "event", event )
  }

  public isHighlighted ( eventId: string ): boolean {
    return this.highlightedEventId ( ) === eventId
  }

  public getGoogleMapsUrl ( location: string ): string {
    return getGoogleMapsUrl ( location )
  }

  public downloadIcs ( event: ReviveEvent ): void {
    downloadEventIcs ( event )
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
    await this.getEvents ( true )
    const current = this.events ( ).find ( e => e.id === event.id ) || event

    if ( current.isFull && !current.waitlistOpen && current.donationRequired === "required" ) {
      this.toastrSvc.error ( "This event is fully booked." )
      return
    }

    const needsPayment = current.donationRequired === "required"
    const waitlistOnly = !!current.isFull && !!current.waitlistOpen
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.setInput ( "title", waitlistOnly ? `Join waitlist — ${current.title}` : `Register for ${current.title}` )
    modalRef.setInput (
      "body",
      waitlistOnly
        ? `This event is full. You can join the waitlist for "${current.title}". We'll contact you if a place opens.`
        : needsPayment
          ? `Please fill out the form below. You'll be taken to Stripe to pay — your registration is only confirmed after payment succeeds.`
          : `Please fill out the form below to register for "${current.title}". You'll receive a confirmation email shortly after submitting.`
    )
    modalRef.setInput (
      "confirmText",
      needsPayment ? "Proceed to Payment" : "Submit"
    )
    modalRef.setInput ( "recaptchaActive", true )

    const fields = this.buildRegistrationFields ( current )
    modalRef.setInput ( "fields", fields )

    await modalRef.result.then ( async ( result: Record<string, unknown> ) => {
      if ( result ) {
        if ( !modalRef.componentInstance.captchaToken ) {
          console.error ( "No reCAPTCHA token available." )
          return
        }

        this.loading.set ( true )
        try {
          const res = await this.apiSvc.post ( `/api/events/${current.id}/register`, {
            ...result,
            recaptchaToken: modalRef.componentInstance.captchaToken
          } ) as { message: string; checkoutUrl?: string; donateLaterUrl?: string; draftId?: string; cancelToken?: string }

          if ( res.checkoutUrl ) {
            const alreadyRegistered = ( res as { status?: string } ).status === "completed"
            if ( res.draftId ) {
              sessionStorage.setItem ( "checkoutDraftId", res.draftId )
              sessionStorage.setItem ( "checkoutUrl", res.checkoutUrl )
              sessionStorage.setItem ( "checkoutEventTitle", current.title )
              sessionStorage.setItem ( "checkoutIsOptionalDonation", alreadyRegistered ? "1" : "0" )
              if ( res.cancelToken ) {
                sessionStorage.setItem ( "checkoutCancelToken", res.cancelToken )
              }
            }
            this.toastrSvc.info (
              alreadyRegistered
                ? "You're registered. Taking you to Stripe to complete your optional donation."
                : "Taking you to Stripe. Your registration is not saved until payment is completed.",
              alreadyRegistered ? "Optional donation" : "Payment required",
              { timeOut: 6000 }
            )
            await new Promise ( resolve => setTimeout ( resolve, 900 ) )
            window.location.href = res.checkoutUrl
          } else {
            const successRef = this.modalSvc.open ( SuccessModalComponent, {
              centered: true,
              bare: true
            } )
            successRef.setInput ( "eventTitle", current.title )
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
            centered: true,
            bare: true
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

  private focusEventFromQuery ( eventId: string ): void {
    this.highlightedEventId.set ( eventId )

    const scrollToEvent = ( ): void => {
      document.getElementById ( `event-${eventId}` )?.scrollIntoView ( { behavior: "smooth", block: "center" } )
    }

    requestAnimationFrame ( ( ) => {
      scrollToEvent ( )
      window.setTimeout ( scrollToEvent, 400 )
    } )
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
      const status = params [ "registration" ] as string | undefined
      const eventId = params [ "eventId" ] as string | undefined
      const draftId = ( params [ "draftId" ] as string | undefined )
        || sessionStorage.getItem ( "checkoutDraftId" )
        || undefined

      if ( status === "success" ) {
        const title = sessionStorage.getItem ( "checkoutEventTitle" )
          || this.events ( ).find ( e => e.id === eventId )?.title
          || ""
        const cancelToken = sessionStorage.getItem ( "checkoutCancelToken" ) || undefined
        void this.showRegistrationSuccess ( draftId, title, cancelToken, eventId )
        this.clearStoredCheckoutState ( )
        this.clearQueryParams ( )
        return
      }

      if ( status === "cancelled" ) {
        const cancelToken = sessionStorage.getItem ( "checkoutCancelToken" ) || undefined
        void this.handlePaymentCancelled ( draftId, cancelToken )
        return
      }

      if ( eventId && this.events ( ).some ( e => e.id === eventId ) ) {
        this.focusEventFromQuery ( eventId )
      }
    } )
  }

  private async handlePaymentCancelled (
    draftId: string | undefined,
    cancelToken: string | undefined
  ): Promise<void> {
    const isOptionalDonation = sessionStorage.getItem ( "checkoutIsOptionalDonation" ) === "1"
    await this.sendPaymentPromptAfterCancel ( draftId, cancelToken )

    const errorRef = this.modalSvc.open ( ErrorModalComponent, {
      centered: true,
      bare: true
    } )
    errorRef.setInput ( "title", "Payment Cancelled" )
    errorRef.setInput (
      "message",
      isOptionalDonation
        ? "Your optional donation wasn't completed, but your registration is still confirmed. Use the resume payment link above when you're ready, or contact us if you need help."
        : "Payment was cancelled, so your registration was not completed. Use the resume payment link above to try again, or contact us if you need help."
    )
    errorRef.setInput ( "type", "warning" )

    this.clearQueryParams ( )
  }

  private async showRegistrationSuccess (
    draftId: string | undefined,
    title: string,
    cancelToken?: string,
    eventId?: string
  ): Promise<void> {
    if ( draftId && cancelToken ) {
      const status = await this.pollCheckoutStatus ( draftId, cancelToken )
      if ( status === "pending" ) {
        const warnRef = this.modalSvc.open ( ErrorModalComponent, { centered: true, bare: true } )
        warnRef.setInput ( "title", "Payment Processing" )
        warnRef.setInput ( "message", "Your payment is still being confirmed. You'll receive confirmation shortly — if not, contact us with your receipt." )
        warnRef.setInput ( "type", "warning" )
        return
      }
      if ( status === "refunded" ) {
        const errRef = this.modalSvc.open ( ErrorModalComponent, { centered: true, bare: true } )
        errRef.setInput ( "title", "Event Fully Booked" )
        errRef.setInput ( "message", "Your payment was refunded because the event filled up before it completed. Contact us if you don't see the refund within a few days." )
        errRef.setInput ( "type", "warning" )
        return
      }
      if ( status === "not_found" ) {
        const warnRef = this.modalSvc.open ( ErrorModalComponent, { centered: true, bare: true } )
        warnRef.setInput ( "title", "Payment Processing" )
        warnRef.setInput ( "message", "Your payment was received and we're confirming your place. If you don't hear from us, contact us with your Stripe receipt." )
        warnRef.setInput ( "type", "warning" )
        return
      }
      if ( status !== "paid" ) {
        return
      }
    }

    await this.getEvents ( true )

    const resolvedTitle = title
      || this.events ( ).find ( e => e.id === eventId )?.title
      || ""

    const successRef = this.modalSvc.open ( SuccessModalComponent, { centered: true, bare: true } )
    successRef.setInput ( "eventTitle", resolvedTitle )
  }

  /** Poll a few times so a slow webhook doesn't flash a false failure. */
  private async pollCheckoutStatus (
    draftId: string,
    cancelToken: string
  ): Promise<string | undefined> {
    const delays = [ 0, 800, 1600, 2500 ]
    let last: string | undefined
    for ( const wait of delays ) {
      if ( wait ) await new Promise ( r => setTimeout ( r, wait ) )
      try {
        const res = await this.apiSvc.get ( `/api/events/checkout-draft/${draftId}/status`, {
          cancelToken
        } ) as { status?: string }
        last = res?.status
        if ( last === "paid" || last === "refunded" ) return last
      } catch {
        return undefined
      }
    }
    return last
  }

  private clearStoredCheckoutState ( ): void {
    sessionStorage.removeItem ( "checkoutDraftId" )
    sessionStorage.removeItem ( "checkoutCancelToken" )
    sessionStorage.removeItem ( "checkoutUrl" )
    sessionStorage.removeItem ( "checkoutEventTitle" )
    sessionStorage.removeItem ( "checkoutIsOptionalDonation" )
    this.resumePaymentUrl.set ( null )
  }

  private async reconcileStoredCheckoutState ( ): Promise<void> {
    const draftId = sessionStorage.getItem ( "checkoutDraftId" )
    const cancelToken = sessionStorage.getItem ( "checkoutCancelToken" )
    const cachedUrl = sessionStorage.getItem ( "checkoutUrl" )

    if ( cachedUrl && !this.resumePaymentUrl ( ) ) {
      this.resumePaymentUrl.set ( cachedUrl )
    }

    if ( !draftId || !cancelToken ) return

    try {
      const res = await this.apiSvc.get ( `/api/events/checkout-draft/${draftId}/status`, {
        cancelToken
      } ) as { status?: string }
      if ( res.status === "not_found" || res.status === "refunded" ) {
        this.clearStoredCheckoutState ( )
      }
    } catch {
      // Leave banner in place if status cannot be checked
    }
  }

  private async sendPaymentPromptAfterCancel (
    draftId: string | undefined,
    cancelToken?: string
  ): Promise<void> {
    if ( !draftId || !cancelToken ) return
    try {
      const res = await this.apiSvc.post ( `/api/events/checkout-draft/${draftId}/discard`, { cancelToken } ) as {
        hostedInvoiceUrl?: string | null
        checkoutUrl?: string | null
        cancelToken?: string
      }
      const payUrl = res?.checkoutUrl || res?.hostedInvoiceUrl
      if ( payUrl ) {
        this.resumePaymentUrl.set ( payUrl )
        sessionStorage.setItem ( "checkoutUrl", payUrl )
      }
      if ( res?.cancelToken ) {
        sessionStorage.setItem ( "checkoutCancelToken", res.cancelToken )
      }
      sessionStorage.setItem ( "checkoutDraftId", draftId )
    } catch ( e ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Failed to create resume payment link after cancel:", e )
      }
    }
  }

  private clearQueryParams ( ): void {
    this.router.navigate ( [ ], {
      relativeTo: this.route,
      queryParams: {
        registration: null,
        draftId: null,
        cancelToken: null,
        eventId: null
      },
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
