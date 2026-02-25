import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router } from "@angular/router"
import { NgbCollapse, NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap"
import { IconComponent } from "@revive/src/app/icon/icon.component"

@Component ( {
  selector: "app-navbar",
  imports: [
    NgbCollapse,
    NgbDropdownModule,
    IconComponent
  ],
  templateUrl: "./navbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class NavbarComponent implements OnInit {
  public url: WritableSignal<string> = signal ( "" )

  public isMenuCollapsed: WritableSignal<boolean> = signal ( true )

  public readonly location: Location = inject ( Location )
  private readonly router: Router = inject ( Router )

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
}
