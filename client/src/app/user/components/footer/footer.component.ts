import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { TermsComponent } from "../terms/terms.component"
import { ModalService } from "@app/services/modal.service"
import { Router } from "@angular/router"
import { DatesService } from "@services/dates.service"
import { version } from "@revive/package.json"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AuthService } from "@app/services/auth.service"
import { IconComponent } from "@app/icon/icon.component"

@Component ( {
  selector: "app-footer",
  imports: [ IconComponent ],
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FooterComponent {
  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"
  public version = version

  public readonly modalSvc: ModalService = inject ( ModalService )
  public readonly router: Router = inject ( Router )
  public readonly dateSvc: DatesService = inject ( DatesService )
  public readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public openTerms ( ) {
    this.modalSvc.open ( TermsComponent, { size: "lg", backdrop: "static" } )
  }

  public async goToAdmin ( ) {
    if ( this.authSvc.adminAccessInProgress ( ) ) {
      return
    }

    this.authSvc.beginAdminAccess ( )
    try {
      if ( this.authSvc.currentUser ( ) && await this.authSvc.isAdminUser ( ) ) {
        await this.router.navigate ( [ "/admin/dashboard" ] )
        return
      }

      if ( this.authSvc.currentUser ( ) ) {
        await this.authSvc.logout ( )
      }

      await this.authSvc.login ( )
      await this.router.navigate ( [ "/admin/dashboard" ] )
    } catch ( e ) {
      const message = e instanceof Error ? e.message : "Login Unauthorized"
      this.toastrSvc.error ( message )
    } finally {
      this.authSvc.endAdminAccess ( )
    }
  }
}
