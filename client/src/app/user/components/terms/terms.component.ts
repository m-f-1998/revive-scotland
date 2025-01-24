import { ChangeDetectionStrategy, Component } from "@angular/core"
import { NgbActiveModal, NgbModule } from "@ng-bootstrap/ng-bootstrap"
import { text, lastUpdated, contact } from "./terms.json"

@Component ( {
  selector: "app-terms",
  imports: [
    NgbModule
  ],
  templateUrl: "./terms.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TermsComponent {

  public body = text
  public contact = contact
  public lastUpdated = lastUpdated

  public constructor (
    private modalRef: NgbActiveModal
  ) { }

  public close ( ) {
    this.modalRef.close ( )
  }
}
