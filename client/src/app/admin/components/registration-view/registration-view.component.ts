import { CurrencyPipe } from "@angular/common"
import { Component, Input } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal, NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { DatesService } from "@services/DateService.service"
import { PolicyViewComponent } from "../policy-view/policy-view.component"

@Component ( {
  selector: "app-admin-registration-view",
  standalone: true,
  imports: [
    FaIconComponent,
    CurrencyPipe
  ],
  templateUrl: "./registration-view.component.html"
} )
export class RegistrationViewComponent {
  @Input ( ) public registration: any = ""

  public loading = true
  public faSpinner = faSpinner

  public constructor (
    private activeModal: NgbActiveModal,
    private modalSvc: NgbModal,
    public dateSvc: DatesService
  ) { }

  public close ( ) {
    this.activeModal.dismiss ( )
  }

  public openPolicy ( title: string, description: string ) {
    const modalRef = this.modalSvc.open ( PolicyViewComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = title
    modalRef.componentInstance.description = description
  }
}
