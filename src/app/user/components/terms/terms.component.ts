import { Component } from "@angular/core"
import { NgbActiveModal, NgbModule } from "@ng-bootstrap/ng-bootstrap"
import { text, lastUpdated, contact } from "./terms.json"

@Component ( {
  standalone: true,
  imports: [
    NgbModule
  ],
  templateUrl: "./terms.component.html"
} )
export class TermsComponent {

  public body = text
  public contact = contact
  public lastUpdated = lastUpdated

  constructor (
    private modalRef: NgbActiveModal
  ) { }

  public close ( ) {
    this.modalRef.close ( )
  }
}
