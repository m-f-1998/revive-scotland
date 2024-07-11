import { Component } from "@angular/core"
import { TermsComponent } from "@components/terms/terms.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"

@Component ( {
  selector: "app-footer",
  standalone: true,
  imports: [],
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss"
} )
export class FooterComponent {

  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"

  constructor (
    public modalSvc: NgbModal
  ) { }

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }

}
