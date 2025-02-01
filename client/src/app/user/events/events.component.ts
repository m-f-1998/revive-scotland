import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { faCalendar, faInfoCircle, faMapMarker, faMoneyBill, faSpinner, faUser, faWarning } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { DatesService } from "@services/dates.service"
import { EventsService } from "@services/events.service"
import { ContactComponent } from "@components/contact/contact.component"

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    FaIconComponent,
    ContactComponent
  ],
  templateUrl: "./events.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventsComponent implements OnInit {
  public events: WritableSignal<Array<Array<any>>> = signal ( [ ] )
  public quote = "Prayer, as a means of drawing ever new strength from Christ, is concretely and urgently needed."
  public quoteAuthor = "Benedict XVI"

  public loading: WritableSignal<boolean> = signal ( true )
  public error: WritableSignal<boolean> = signal ( false )
  public errorMessage: WritableSignal<string> = signal ( "" )

  public faSpinner = faSpinner
  public faError = faWarning
  public faMoney = faMoneyBill
  public faMapMarker = faMapMarker
  public faCalendar = faCalendar
  public faInfo = faInfoCircle
  public faPerson = faUser

  public constructor (
    private eventsSvc: EventsService,
    public dateSvc: DatesService
  ) { }

  public ngOnInit ( ) {
    const chunkSize = 2
    this.eventsSvc.getEvents ( ).then ( ( events: Array<any> ) => {
      for ( let i = 0; i < events.length; i += chunkSize ) {
        const row = events.slice ( i, i + chunkSize )
        this.events.set ( [
          ...this.events ( ),
          row
        ] )
      }
      this.loading.set ( false )
    } ).catch ( ( error: any ) => {
      console.error ( error )
      this.error.set ( true )
    } )
  }
}
