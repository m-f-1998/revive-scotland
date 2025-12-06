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

  public ngOnInit ( ) {
    this.getEvents ( )
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
