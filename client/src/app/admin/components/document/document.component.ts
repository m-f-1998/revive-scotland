import { ChangeDetectionStrategy, Component, Input, OnInit, signal, WritableSignal } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { ApiService } from "@services/api.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-document",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./document.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminDocumentComponent implements OnInit {
  @Input ( ) public documentLink: string = ""
  @Input ( ) public title: string = ""

  public loading: WritableSignal<boolean> = signal ( true )
  public faSpinner = faSpinner

  public href: WritableSignal<string> = signal ( "" )

  public constructor (
    private activeModal: NgbActiveModal,
    private apiSvc: ApiService,
    private toastrSvc: ToastrService
  ) {
  }

  public ngOnInit ( ) {
    if ( !this.documentLink ) {
      this.toastrSvc.error ( "No document link provided." )
      this.close ( )
    } else {
      this.apiSvc.request ( "/asset.php", {
        url: this.documentLink
      }, "POST" ).then ( ( blob: any ) => {
        this.href.set ( URL.createObjectURL ( blob ) )
        if ( this.documentLink.endsWith ( ".pdf" ) ) {
          window.open ( this.href ( ), "_blank" )
          this.close ( )
        } else {
          this.loading.set ( false )
        }
        setTimeout ( ( ) => {
          URL.revokeObjectURL ( this.href ( ) )
        }, 1000 )
      } ).catch ( e => {
        this.toastrSvc.error ( "There was an error opening the file." )
        console.error ( e )
      } )
    }
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
