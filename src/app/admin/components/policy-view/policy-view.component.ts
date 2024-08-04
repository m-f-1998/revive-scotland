import { CurrencyPipe } from "@angular/common"
import { Component, Input } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-policy-view",
  standalone: true,
  imports: [
    FaIconComponent
  ],
  providers: [
    CurrencyPipe
  ],
  templateUrl: "./policy-view.component.html"
} )
export class PolicyViewComponent {
  @Input ( ) public title: any = ""
  @Input ( ) public description: any = ""

  public faSpinner = faSpinner

  public constructor (
    private apiSvc: HttpService,
    private activeModal: NgbActiveModal,
    private toastrSvc: ToastrService
  ) { }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
