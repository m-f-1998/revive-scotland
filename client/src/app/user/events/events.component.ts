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
import { IconService } from "@services/icons.service"
import { FormlyService } from "@services/formly.service"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { Event } from "../../interfaces/events.interface"
import { HeadersService } from "../../services/headers.service"
import { Header } from "../../interfaces/headers.interface"
import { v4 as uuidv4 } from "uuid"
import { NgOptimizedImage } from "@angular/common"

export interface Questionnaire {
  title: string
  description: string
  price?: number
  location: string
  image: string
  start: Date
  end: Date
  fields?: FormlyFieldConfig [ ]
  url?: string
}

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    FaIconComponent,
    ContactComponent,
    NavbarComponent,
    SliderComponent,
    NgOptimizedImage
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventsComponent implements OnInit {
  public slides: WritableSignal<Header [ ]> = signal ( [
    {
      id: uuidv4 ( ),
      title: "Upcoming Events",
      description: "Revive Scotland",
      filename: "assets/img/hero-bg-4.jpg"
    },
    {
      id: uuidv4 ( ),
      title: "Upcoming Events",
      description: "Revive Scotland",
      filename: "assets/img/hero-bg-5.jpg"
    },
  ] )

  public readonly events: WritableSignal<Event [ ]> = signal ( [ ] )
  public questionnaires: Questionnaire [ ] = [ ]

  public readonly loading: WritableSignal<boolean> = signal ( true )

  public readonly eventsSvc: EventsService = inject ( EventsService )
  public readonly headersSvc: HeadersService = inject ( HeadersService )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly iconSvc: IconService = inject ( IconService )
  public readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public ngOnInit ( ) {
    this.getEvents ( )
    this.loadHeaders ( )
  }

  public openQuestionnaire ( event: any ) {
    if ( event.url ) {
      window.open ( event.url, "_blank" )
    } else if ( event.fields ) {
      const modalRef = this.modalSvc.open ( QuestionnaireComponent, {
        size: "xl"
      } )
      modalRef.componentInstance.event = event
    }
  }

  private async getEvents ( ) {
    try {
      this.events.set ( await this.eventsSvc.getEvents ( ) || [ ] )
    } catch ( error: any ) {
      if ( isDevMode ( ) ) {
        console.error ( error )
      }
    } finally {
      this.loading.set ( false )
    }
  }

  private async loadHeaders ( ) {
    this.slides.set ( await this.headersSvc.getHeaders ( "/events" ) || [ ] )
  }
}
