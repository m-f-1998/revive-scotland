import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { faSpinner, faWarning } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { ViewEventComponent } from "../view-event/view-event.component"
import { DatesService } from "@services/dates.service"
import { EventsService } from "@services/events.service"

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
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

  public constructor (
    private eventsSvc: EventsService,
    private modalSvc: NgbModal,
    public dateSvc: DatesService
  ) { }

  public ngOnInit ( ) {
    const chunkSize = 2
    this.eventsSvc.getEvents ( ).then ( ( events: Array<any> ) => {
      for ( let i = 0; i < events.length; i += chunkSize ) {
        const row = events.slice ( i, i + chunkSize )
        // for ( const event of row ) {
        //   if ( event.featured_image ) {
        //     this.createBlobURL ( event.featured_image ).then ( ( url: string | void ) => {
        //       event.featured_href = url ?? ""
        //     } )
        //   }
        //   if ( event.poster_link ) {
        //     this.createBlobURL ( event.poster_link ).then ( ( url: string | void ) => {
        //       event.poster_href = url ?? ""
        //     } )
        //   }
        //   if ( event.timetable_link ) {
        //     this.createBlobURL ( event.timetable_link ).then ( ( url: string | void ) => {
        //       event.timetable_href = url ?? ""
        //     } )
        //   }
        // }
        this.events.set ( [
          ...this.events ( ),
          row
        ] )
      }
      this.loading.set ( false )
    } ).catch ( ( error: any ) => {
      console.error ( error )
      this.error.set ( true )
      this.errorMessage.set ( "Failed to load events" )
    } )
  }

  public viewGDPR ( _event: any ) {
    console.log ( "View GDPR" )
  }

  public viewTerms ( _event: any ) {
    console.log ( "View Terms" )
  }

  public isImage ( link: string ) {
    return !link.endsWith ( ".pdf" )
  }

  public goToEvent ( event: any ) {
    const modalRef = this.modalSvc.open ( ViewEventComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.event = event
  }
}
