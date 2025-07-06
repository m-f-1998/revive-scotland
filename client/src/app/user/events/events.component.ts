import { ChangeDetectionStrategy, Component, inject, isDevMode, OnInit, signal, WritableSignal } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { DatesService } from "@services/dates.service"
import { EventsService } from "@services/events.service"
import { ContactComponent } from "@components/contact/contact.component"
import { SliderComponent } from "@components/slider/slider.component"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { QuestionnaireComponent } from "./questionnaire/questionnaire.component"
import { IconService } from "../../services/icons.service"
import { FormlyService } from "../../services/formly.service"

export interface Questionnaire {
  title: string
  description: string
  price: number
  location: string
  image: string
  start: Date
  end: Date
  fields: FormlyFieldConfig [ ]
}

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    FaIconComponent,
    ContactComponent,
    SliderComponent
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
      image: "assets/img/hero-bg-4.jpg"
    },
    {
      title: "Upcoming Events",
      content: "Revive Scotland",
      image: "assets/img/hero-bg-5.jpg"
    },
  ]

  public readonly events: WritableSignal<Array<any>> = signal ( [ ] )
  public questionnaires: Questionnaire [ ] = [ ]

  public readonly loading: WritableSignal<boolean> = signal ( true )

  public readonly eventsSvc: EventsService = inject ( EventsService )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly iconSvc: IconService = inject ( IconService )
  public readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public ngOnInit ( ) {
    this.questionnaires = [
      {
        title: "'Journey to Rome' - Expression of Interest",
        description: "Join us on a pilgrimage to the Eternal City for the Marian Jubilee. Express your interest by completing the form below. Includes flights, accomodation, breakfast and lunch.",
        price: 650,
        location: "Rome, Italy",
        image: "assets/img/trip-to-rome.png",
        start: new Date ( "2025-10-07" ),
        end: new Date ( "2025-10-12" ),
        fields: [
          this.formlySvc.TextInput ( "name", {
            label: "Name",
            required: true
          } ),
          this.formlySvc.EmailInput ( "email", {
            label: "Email",
            required: true
          } ),
          this.formlySvc.TextAreaInput ( "questions", {
            label: "Questions",
            required: true,
            maxLength: 500,
            minLength: 0,
            includeMaxDescription: true
          } ),
          this.formlySvc.CheckboxInput ( "interest", {
            label: "Are you interested in joining us on this pilgrimage?"
          } )
        ]
      }
    ]
    this.getEvents ( )
  }

  public openQuestionnaire ( event: any ) {
    const modalRef = this.modalSvc.open ( QuestionnaireComponent, {
      size: "xl"
    } )
    modalRef.componentInstance.event = event
  }

  private async getEvents ( ) {
    try {
      const events = await this.eventsSvc.getEvents ( )
      this.events.set ( events )
    } catch ( error: any ) {
      if ( isDevMode ( ) ) {
        console.error ( error )
      }
    } finally {
      this.loading.set ( false )
    }
  }
}
