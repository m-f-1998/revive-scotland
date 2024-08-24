import { CurrencyPipe } from "@angular/common"
import { Component, Input, OnInit } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal, NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { DatesService } from "@services/DateService.service"
import { PolicyViewComponent } from "../policy-view/policy-view.component"
import { HttpService } from "@services/HttpService.service"

@Component ( {
  selector: "app-admin-registration-view",
  standalone: true,
  imports: [
    FaIconComponent,
    CurrencyPipe
  ],
  templateUrl: "./registration-view.component.html"
} )
export class RegistrationViewComponent implements OnInit {
  @Input ( ) public registration: any = { }

  public loading = true
  public faSpinner = faSpinner

  public constructor (
    private activeModal: NgbActiveModal,
    private modalSvc: NgbModal,
    public dateSvc: DatesService,
    private apiSvc: HttpService
  ) { }

  public ngOnInit ( ) {
    for ( const details of this.registration ) {
      if ( details.featured_image ) {
        this.createBlobURL ( details.featured_image ).then ( ( url: string | void ) => {
          details.featured_href = url ?? ""
        } )
      }
      if ( details.poster_link ) {
        this.createBlobURL ( details.poster_link ).then ( ( url: string | void ) => {
          details.poster_href = url ?? ""
        } )
      }
      if ( details.timetable_link ) {
        this.createBlobURL ( details.timetable_link ).then ( ( url: string | void ) => {
          details.timetable_href = url ?? ""
        } )
      }
    }
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }


  public createBlobURL ( documentLink: string ) {
    return this.apiSvc.request ( "/asset.php", {
      url: documentLink
    }, "POST" ).then ( ( blob: any ) => {
      const href = URL.createObjectURL ( blob )
      setTimeout ( ( ) => {
        URL.revokeObjectURL ( href )
      }, 1000 )
      return href
    } ).catch ( e => { } ).finally ( ( ) => {
      this.loading = false
    } )
  }

  public openPolicy ( title: string, description: string ) {
    const modalRef = this.modalSvc.open ( PolicyViewComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = title
    modalRef.componentInstance.description = description
  }
}
