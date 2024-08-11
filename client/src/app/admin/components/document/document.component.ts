import { Component, Input, OnInit } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-document",
  standalone: true,
  imports: [
    FaIconComponent
  ],
  templateUrl: "./document.component.html"
} )
export class AdminDocumentComponent implements OnInit {
  @Input ( ) public documentLink: string = ""
  @Input ( ) public title: string = ""

  public loading = true
  public faSpinner = faSpinner

  public href: string = ""

  public constructor (
    private activeModal: NgbActiveModal,
    private apiSvc: HttpService,
    private toastrSvc: ToastrService
  ) { }

  public ngOnInit ( ) {
    this.apiSvc.request ( "/asset.php", {
      url: this.documentLink
    }, "POST" ).then ( ( blob: any ) => {
      this.href = URL.createObjectURL ( blob )
      this.loading = false
      setTimeout ( ( ) => {
        URL.revokeObjectURL ( this.href )
      }, 1000 )
    } ).catch ( e => {
      this.toastrSvc.error ( "There was an error opening the file." )
      console.error ( e )
    } )
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
