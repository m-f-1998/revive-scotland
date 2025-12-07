import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router } from "@angular/router"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap"
import { IconService } from "@revive/src/app/services/icons.service"
import { AuthService } from "../../services/auth.service"

@Component ( {
  selector: "app-admin-navbar",
  imports: [
    NgbDropdownModule,
    FaIconComponent
  ],
  templateUrl: "./navbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminNavbarComponent implements OnInit {
  public url: WritableSignal<string> = signal ( "" )

  public readonly location: Location = inject ( Location )
  public readonly iconSvc: IconService = inject ( IconService )
  private readonly router: Router = inject ( Router )
  private readonly authSvc: AuthService = inject ( AuthService )

  public ngOnInit ( ) {
    this.router.events.subscribe ( event => {
      if ( event instanceof NavigationEnd ) {
        this.url.set ( this.location.path ( ) )
      }
    } )
    this.url.set ( this.location.path ( ) )
  }

  public scrollTo ( id: string ) {
    requestAnimationFrame ( ( ) => {
      document.querySelector ( id )?.scrollIntoView ( { behavior: "smooth" } )
    } )
  }

  public goTo ( path: string, id?: string ) {
    this.router.navigate ( [ path ] )
    if ( id ) {
      this.scrollTo ( id )
    }
  }

  public async logout ( ) {
    await this.authSvc.logout ( )
    this.router.navigate ( [ "/" ] )
  }
}
