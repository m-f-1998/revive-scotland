import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { Event } from "../../interfaces/events.interface"
import { ApiService } from "../../services/api.service"
import { DatePipe } from "@angular/common"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"
import { EventsService } from "../../services/events.service"
import { IconService } from "../../services/icons.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { eventFields } from "./details-fields"

@Component ( {
  selector: "app-admin-events",
  imports: [
    DatePipe,
    NavigationBarComponent,
    FaIconComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminEventsComponent {
  public events: WritableSignal<Event[]> = signal<Event[]> ( [ ] )
  public loading: WritableSignal<boolean> = signal<boolean> ( true )

  public readonly apiSvc: ApiService = inject ( ApiService )
  public readonly iconSvc: IconService = inject ( IconService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly eventsSvc: EventsService = inject ( EventsService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public constructor ( ) {
    this.eventsSvc.getEvents ( ).then ( events => {
      this.events.set ( events || [ ] )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public createEvent ( ): void {
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      size: "lg",
      backdrop: "static"
    } )
    modalRef.componentInstance.title = "Create New Event"
    modalRef.componentInstance.confirmText = "Create Event"
    modalRef.componentInstance.cancelText = "Cancel"
    modalRef.componentInstance.fields = eventFields
  }

  public editEvent ( _event: Event ): void {

  }

  public deleteEvent ( event: Event ): void {
    if ( confirm ( `Are you sure you want to delete the event: '${ event.title }'` ) ) {
      this.apiSvc.post ( `/api/events/delete`, { id: event.id } ).then ( ( ) => {
        this.events.set ( this.events ( ).filter ( e => e.id !== event.id ) )
        this.toastrSvc.success ( "Event has been deleted." )
      } ).catch ( err => {
        console.error ( "Error deleting event:", err )
        this.toastrSvc.error ( "Please try again.", "There was an error deleting the event." )
      } )
    }
  }
}