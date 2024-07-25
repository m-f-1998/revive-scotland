import { Component } from "@angular/core"
import { TermsComponent } from "../terms/terms.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { Router } from "@angular/router"

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
    public modalSvc: NgbModal,
    public router: Router
  ) { }

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }

  public goToAdmin ( ) {
    this.router.navigate ( [ "/admin" ] )
  }

}
