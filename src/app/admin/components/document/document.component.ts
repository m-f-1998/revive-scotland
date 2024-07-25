import { Component, Input } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"

@Component ( {
  selector: "app-admin-document",
  standalone: true,
  imports: [
    FaIconComponent
  ],
  templateUrl: "./document.component.html"
} )
export class AdminDocumentComponent {
  @Input ( ) public documentLink: string = ""
  @Input ( ) public title: string = ""

  public loading = false
  public faSpinner = faSpinner

  public constructor (
    private activeModal: NgbActiveModal
  ) {

  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
