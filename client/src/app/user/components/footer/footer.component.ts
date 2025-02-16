import { ChangeDetectionStrategy, Component } from "@angular/core"
import { TermsComponent } from "../terms/terms.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { Router } from "@angular/router"
import { environment } from "../../../../environments/environment.prod"
import { DatesService } from "@services/dates.service"

@Component ( {
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FooterComponent {

  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"
  public version = environment.version
  public lastUpdated = environment.lastUpdated

  public constructor (
    public modalSvc: NgbModal,
    public router: Router,
    public dateSvc: DatesService
  ) { }

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }

}
