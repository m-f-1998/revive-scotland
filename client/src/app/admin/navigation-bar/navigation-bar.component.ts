import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { ApplicationService } from "../../services/application.service"
import { ApiService } from "../../services/api.service"
import { Router } from "@angular/router"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Component ( {
  selector: "app-navigation-bar",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./navigation-bar.component.html",
  styleUrl: "./navigation-bar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class NavigationBarComponent {
  public loggingOut: WritableSignal<boolean> = signal ( false )

  public readonly iconSvc: IconService = inject ( IconService )
  public readonly router: Router = inject ( Router )
  private readonly appSvc: ApplicationService = inject ( ApplicationService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public async logout ( ): Promise<void> {
    this.loggingOut.set ( true )
    try {
      await this.apiSvc.post ( "/api/auth/logout" )
      this.appSvc.setLogout ( )
      this.router.navigate ( [ "/login" ] )
    } catch ( e ) {
      console.error ( "Error during logout:", e )
      this.toastrSvc.error ( "There was an error logging out. Please try again." )
      this.loggingOut.set ( false )
    }
  }

  public navigateTo ( route: string ): void {
    if ( this.loggingOut ( ) ) return
    this.router.navigate ( [ `/admin/${route}` ] )
  }
}