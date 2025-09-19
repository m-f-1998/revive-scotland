import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { Event } from "../../interfaces/events.interface"
import { ApiService } from "../../services/api.service"
import { DatePipe } from "@angular/common"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { ApplicationService } from "../../services/application.service"
import { Router } from "@angular/router"

@Component ( {
  selector: "app-admin-events",
  imports: [
    DatePipe
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminEventsComponent {
  public events: WritableSignal<Event[]> = signal<Event[]> ( [ ] )

  public readonly apiSvc: ApiService = inject ( ApiService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly appSvc: ApplicationService = inject ( ApplicationService )
  private readonly router: Router = inject ( Router )

  public constructor ( ) {
    Promise.all ( [
      this.apiSvc.post ( "/api/events" ),
      this.apiSvc.post ( "/api/auth/verify" )
    ] ).then ( ( [ events ] ) => {
      this.events.set ( events as Event [ ] )
    } ).catch ( ( ) => {
      this.appSvc.setLogout ( )
      this.router.navigate ( [ "/login" ] )
    } )
  }

  public createEvent ( ): void {

  }

  public editEvent ( _event: Event ): void {

  }

  public deleteEvent ( event: Event ): void {
    if ( confirm ( `Are you sure you want to delete the event: '${ event.title }'` ) ) {
      this.apiSvc.post ( `/api/events/delete`, { id: event.id } ).then ( ( ) => {
        this.events.set ( this.events ( ).filter ( e => e.id !== event.id ) )
        this.toastrSvc.success ( "Event deleted successfully." )
      } ).catch ( err => {
        console.error ( "Error deleting event:", err )
        this.toastrSvc.error ( "There was an error deleting the event. Please try again." )
      } )
    }
  }
}