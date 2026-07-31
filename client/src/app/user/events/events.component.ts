import { ChangeDetectionStrategy, Component, inject, isDevMode, OnInit, signal, WritableSignal } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { DatesService } from "@services/dates.service"
import { EventsService, ReviveEvent } from "@services/events.service"
import { ContactComponent } from "@components/contact/contact.component"
import { SliderComponent } from "@components/slider/slider.component"
import { FormlyService } from "../../services/formly.service"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { ModalService } from "@revive/src/app/services/modal.service"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { ApiService } from "../../services/api.service"
import { IconComponent } from "../../icon/icon.component"

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

  public readonly eventsSvc: EventsService = inject ( EventsService )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ) {
    this.getEvents ( )
  }

  public openPoster ( imageUrl: string ) {
    window.open ( imageUrl, "_blank" )
  }

  public getGoogleMapsUrl ( location: string ): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent ( location )}`
  }

  public async openContactForm ( event: ReviveEvent ) {
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.setInput ( "title", `Register for ${event.title}` )
    modalRef.setInput ( "body", `Please fill out the form below to register for "${event.title}".` )
    modalRef.setInput ( "confirmText", event.donationRequired === "required" ? "Proceed to Payment" : "Submit" )
    modalRef.setInput ( "recaptchaActive", true )
    modalRef.setInput ( "fields", event.contactFormFields || [ ] )
    await modalRef.result.then ( async ( result: Record<string, unknown> ) => {
      if ( result ) {
        if ( !modalRef.componentInstance.captchaToken ) {
          console.error ( "No reCAPTCHA token available." )
          return
        }

        this.loading.set ( true )
        try {
          const res = await this.apiSvc.post ( `/api/public/events/${event.id}/register`, {
            ...result,
            recaptchaToken: modalRef.componentInstance.captchaToken
          } ) as { message: string; checkoutUrl?: string }

          if ( res.checkoutUrl ) {
            window.location.href = res.checkoutUrl
          } else {
            this.toastrSvc.success ( "Your registration has been submitted successfully.", "Thank You!" )
          }
        } catch ( e ) {
          if ( isDevMode ( ) ) {
            console.error ( e )
          }
          this.toastrSvc.error ( "An error occurred while submitting your registration. Please try again later.", "Error" )
        } finally {
          this.loading.set ( false )
        }
      }
    } ).catch ( ( ) => { } )
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
