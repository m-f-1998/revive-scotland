import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '@services/AdminService.service';
import { HttpService } from '@services/HttpService.service';
import { CurrencyPipe } from '@angular/common';
import { AdminDocumentComponent } from '../components/document/document.component';
import { faEye, faPlus, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { DatesService } from '@services/DateService.service';
import { ToastrService } from 'ngx-toastr';
import { EventViewComponent } from '../components/event-view/event-view.component';
import { EventAddComponent } from '../components/event-add/event-add.component';

@Component ( {
  selector: 'app-admin-events',
  standalone: true,
  imports: [
    CurrencyPipe,
    FaIconComponent
  ],
  templateUrl: './events.component.html',
  styleUrl: './events.component.scss'
} )
export class AdminEventsComponent {
  public events: any[] = []
  public loading = true
  public faSpinner = faSpinner
  public processing = false

  public faTrash = faTrash
  public faView = faEye
  public faPlus = faPlus

  public constructor (
    public adminSvc: AdminService,
    private httpSvc: HttpService,
    private toastrSvc: ToastrService,
    private modalSvc: NgbModal,
    public dateSvc: DatesService
  ) {
    this.httpSvc.request ( "/events.php" ).then ( ( res: any ) => {
      this.events = res
      this.loading = false
    } )
  }

  public openDoc ( title: string, link: string ) {
    const modalRef = this.modalSvc.open ( AdminDocumentComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = title
    modalRef.componentInstance.documentLink = link
  }

  public deleteEvent ( id: string ) {
    if ( !confirm ( "Are you sure you want to delete this event? This action will automatically cancel all event registrations and process any associated refunds." ) ) return
    this.processing = true
    this.httpSvc.request ( "/events.php", {
      "id": id
    }, "DELETE" ).then ( ( ) => {
      this.events = this.events.filter ( x => x.id !== id )
      this.toastrSvc.success ( "Event Deleted" )
    } ).catch ( e => {
      console.error ( e )
      this.toastrSvc.error ( "Failed to Fully Delete Event" )
    } ).finally ( ( ) => {
      this.processing = false
    } )
  }

  public addEvent ( ) {
    const modalRef = this.modalSvc.open ( EventAddComponent, { size: "xl", backdrop: "static" } )
    modalRef.result.finally ( ( ) => {
      if ( modalRef.componentInstance.confirm ) {
        this.toastrSvc.success ( "Event Added" )
        this.loading = true
        this.httpSvc.request ( "/events.php" ).then ( ( res: any ) => {
          this.events = res
          this.loading = false
        } )
      }
    } )
  }

  public viewEvent ( event: any ) {
    const modalRef = this.modalSvc.open ( EventViewComponent, { size: "xl", backdrop: "static" } )
    modalRef.componentInstance.event = event
    modalRef.result.finally ( ( ) => {
      if ( modalRef.componentInstance.confirm ) {
        this.toastrSvc.success ( "Event Updated" )
        this.loading = true
        this.httpSvc.request ( "/events.php" ).then ( ( res: any ) => {
          this.events = res
          this.loading = false
        } )
      }
    } )
  }

}
