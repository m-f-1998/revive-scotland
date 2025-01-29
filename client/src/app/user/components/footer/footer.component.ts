import { ChangeDetectionStrategy, Component } from "@angular/core"
import { TermsComponent } from "../terms/terms.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { Router } from "@angular/router"

@Component ( {
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FooterComponent {

  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"

  public constructor (
    public modalSvc: NgbModal,
    public router: Router
  ) { }

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }

}
