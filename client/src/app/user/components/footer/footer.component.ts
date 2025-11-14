import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { TermsComponent } from "../terms/terms.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { Router } from "@angular/router"
import { DatesService } from "@services/dates.service"
import { version } from "@revive/package.json"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AuthService } from "@revive/src/app/services/auth.service"

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

  public readonly modalSvc: NgbModal = inject ( NgbModal )
  public readonly router: Router = inject ( Router )
  public readonly dateSvc: DatesService = inject ( DatesService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly authSvc: AuthService = inject ( AuthService )

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }

  public async goToAdmin ( ) {
    if ( this.authSvc.currentUser ( ) ) {
      await this.router.navigate ( [ "/admin/dashboard" ] )
    } else {
      try {
        await this.authSvc.login ( )
        await this.router.navigate ( [ "/admin/dashboard" ] )
      } catch {
        this.toastrSvc.error ( "Login failed. If you believe this is an error, please contact support." )
      }
    }
  }
}
