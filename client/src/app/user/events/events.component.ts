import { ChangeDetectionStrategy, Component, inject, isDevMode, OnInit, signal, WritableSignal } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { DatesService } from "@services/dates.service"
import { EventsService, ReviveEvent } from "@services/events.service"
import { ContactComponent } from "@components/contact/contact.component"
import { SliderComponent } from "@components/slider/slider.component"
import { IconService } from "../../services/icons.service"
import { FormlyService } from "../../services/formly.service"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { ApiService } from "../../services/api.service"

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    FaIconComponent,
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
      image: "skye/event-image-1.jpg"
    },
    {
      title: "Upcoming Events",
      content: "Revive Scotland",
      image: "skye/event-image-3.jpg"
    },
  ]

  public readonly events: WritableSignal<Array<ReviveEvent>> = signal ( [ ] )
  public readonly loading: WritableSignal<boolean> = signal ( true )

  public readonly eventsSvc: EventsService = inject ( EventsService )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly iconSvc: IconService = inject ( IconService )
  public readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ) {
    this.getEvents ( )
  }

  public openPoster ( imageUrl: string ) {
    window.open ( imageUrl, "_blank" )
  }

  public async openContactForm ( event: ReviveEvent ) {
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.componentInstance.title = `Contact Organiser for ${event.title}`
    modalRef.componentInstance.body = `Please fill out the form below to get in touch with the organiser of "${event.title}".`
    modalRef.componentInstance.confirmText = "Submit"
    modalRef.componentInstance.recaptchaActive = true
    modalRef.componentInstance.fields = event.contactFormFields || [ ]
    await modalRef.result.then ( async ( result: any ) => {
      if ( result ) {
        if ( !modalRef.componentInstance.captchaToken ) {
          console.error ( "No reCAPTCHA token available." )
          return
        }

        const messageLines = Object.entries ( result ).map ( ( [ key, value ] ) => {
          const label = event.contactFormFields?.find ( f => f.key === key )?.props?.label || key
          let messageValue = value || "(No Response)"
          if ( messageValue instanceof Boolean ) {
            messageValue = messageValue ? "Yes" : "No"
          }
          return `<p><strong>${label}:</strong> ${messageValue}</p>`
        } )
        const messageHtml = messageLines.join ( "" )

        this.loading.set ( true )
        try {
          await this.apiSvc.post ( "/api/mailer", {
            subject: `Event Enquiry: ${event.title}`,
            message: messageHtml,
            recaptchaToken: modalRef.componentInstance.captchaToken
          } )
          this.toastrSvc.success ( "Your message has been sent successfully.", "Thank You!" )
        } catch ( e: any ) {
          this.toastrSvc.error ( e?.error?.message ?? "An Unexpected Error Occured", "Please Try Again Later" )
          console.error ( e )
        } finally {
          this.loading.set ( false )
        }
      }
    } ).catch ( ( ) => { } )
  }

  private async getEvents ( ) {
    try {
      this.events.set ( await this.eventsSvc.getEvents ( ) )
    } catch ( error: any ) {
      if ( isDevMode ( ) ) {
        console.error ( error )
      }
    } finally {
      this.loading.set ( false )
    }
  }
}
