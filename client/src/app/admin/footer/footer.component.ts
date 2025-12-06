import { ChangeDetectionStrategy, Component } from "@angular/core"
// import { Router } from "@angular/router"
import { version } from "@revive/package.json"
// import { ToastrService } from "@m-f-1998/ngx-toastr"
// import { AuthService } from "@revive/src/app/services/auth.service"
// import { FaIconComponent } from "@fortawesome/angular-fontawesome"
// import { IconService } from "../../services/icons.service"

@Component ( {
  selector: "app-admin-footer",
  // imports: [
  //   FaIconComponent
  // ],
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminFooterComponent {
  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"
  public version = version

  // public readonly iconSvc: IconService = inject ( IconService )
  // public readonly router: Router = inject ( Router )
  // private readonly toastrSvc: ToastrService = inject ( ToastrService )
  // private readonly authSvc: AuthService = inject ( AuthService )

  // public logout ( ) {
  //   this.authSvc.logout ( )
  //     .then ( ( ) => {
  //       this.toastrSvc.success ( "You have been logged out successfully." )
  //       this.router.navigate ( [ "/" ] )
  //     } )
  //     .catch ( ( ) => {
  //       this.toastrSvc.error ( "Logout failed. If you believe this is an error, please contact support." )
  //     } )
  // }
}
