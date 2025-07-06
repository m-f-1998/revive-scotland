import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { TermsComponent } from "../terms/terms.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { Router } from "@angular/router"
import { DatesService } from "@services/dates.service"
import { version } from "@revive/package.json"

@Component ( {
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FooterComponent {
  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"
  public version = version

  public modalSvc: NgbModal = inject ( NgbModal )
  public router: Router = inject ( Router )
  public dateSvc: DatesService = inject ( DatesService )

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }
}
