import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router } from "@angular/router"
import { NgbCollapse, NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap"
import { AuthService } from "../../services/auth.service"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "app-admin-navbar",
  imports: [
    NgbCollapse,
    NgbDropdownModule,
    IconComponent
  ],
  templateUrl: "./navbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminNavbarComponent implements OnInit {
  public url: WritableSignal<string> = signal ( "" )

  public isMenuCollapsed: WritableSignal<boolean> = signal ( true )

  public readonly location: Location = inject ( Location )
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

  public goTo ( routerLink: string = "", id?: string ) {
    this.isMenuCollapsed.set ( true )
    this.router.navigate ( [ routerLink ], id ? { fragment: id } : undefined )
  }

  public toggleMenu ( ) {
    this.isMenuCollapsed.set ( !this.isMenuCollapsed ( ) )
  }

  public async logout ( ) {
    await this.authSvc.logout ( )
    this.router.navigate ( [ "/" ] )
  }
}
