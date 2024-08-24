import { Component, OnInit } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { faSpinner, faWarning } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { HttpService } from "@services/HttpService.service"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { ViewEventComponent } from "../view-event/view-event.component"
import { DatesService } from "@services/DateService.service"
import { PolicyViewComponent } from "../../admin/components/policy-view/policy-view.component"

@Component ( {
  selector: "app-events",
  standalone: true,
  imports: [
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss"
} )
export class EventsComponent implements OnInit {
  public events: any[][] = [ ]
  public quote = "Prayer, as a means of drawing ever new strength from Christ, is concretely and urgently needed."
  public quoteAuthor = "Benedict XVI"

  public loading = true
  public error = false
  public errorMessage = ""

  public faSpinner = faSpinner
  public faError = faWarning

  constructor (
    private apiSvc: HttpService,
    private modalSvc: NgbModal,
    public dateSvc: DatesService
  ) { }

  public ngOnInit ( ) {
    this.apiSvc.request ( "/events.php", { } ).then ( ( data: any ) => {
      const chunkSize = 2
      for ( let i = 0; i < data.length; i += chunkSize ) {
        const row = data.slice ( i, i + chunkSize )
        for ( const event of row ) {
          if ( event.featured_image ) {
            this.createBlobURL ( event.featured_image ).then ( ( url: string | void ) => {
              event.featured_href = url ?? ""
            } )
          }
          if ( event.poster_link ) {
            this.createBlobURL ( event.poster_link ).then ( ( url: string | void ) => {
              event.poster_href = url ?? ""
            } )
          }
          if ( event.timetable_link ) {
            this.createBlobURL ( event.timetable_link ).then ( ( url: string | void ) => {
              event.timetable_href = url ?? ""
            } )
          }
        }
        this.events.push ( row )
      }
      this.loading = false
    } ).catch ( e => {
      console.error ( e )
      this.errorMessage = e.error
      this.error = true
      this.loading = false
    } )
  }

  public createBlobURL ( documentLink: string ) {
    return this.apiSvc.request ( "/asset.php", {
      url: documentLink
    } ).then ( ( blob: any ) => {
      const href = URL.createObjectURL ( blob )
      setTimeout ( ( ) => {
        URL.revokeObjectURL ( href )
      }, 1000 )
      return href
    } ).catch ( e => { } ).finally ( ( ) => {
      this.loading = false
    } )
  }

  public viewGDPR ( event: any ) {
    const modalRef = this.modalSvc.open ( PolicyViewComponent, { size: "lg" } )
    modalRef.componentInstance.title = event.gdpr_title
    modalRef.componentInstance.description = event.gdpr_description
  }

  public viewTerms ( event: any ) {
    const modalRef = this.modalSvc.open ( PolicyViewComponent, { size: "lg" } )
    modalRef.componentInstance.title = event.policy_title
    modalRef.componentInstance.description = event.policy_description
  }

  public isImage ( link: string ) {
    return !link.endsWith ( ".pdf" )
  }

  public goToEvent ( event: any ) {
    const modalRef = this.modalSvc.open ( ViewEventComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.event = event
  }
}
