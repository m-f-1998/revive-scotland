import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router } from "@angular/router"
import { IconComponent } from "@app/icon/icon.component"

@Component ( {
  selector: "app-navbar",
  imports: [
    IconComponent
  ],
  templateUrl: "./navbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:click)": "onDocumentClick($event)",
    "(window:scroll)": "onWindowScroll( )"
  }
} )
export class NavbarComponent implements OnInit {
  public url: WritableSignal<string> = signal ( "" )

  public isMenuCollapsed: WritableSignal<boolean> = signal ( true )
  public isScrolled: WritableSignal<boolean> = signal ( false )

  public readonly location: Location = inject ( Location )
  private readonly router: Router = inject ( Router )

  public ngOnInit ( ) {
    this.router.events.subscribe ( event => {
      if ( event instanceof NavigationEnd ) {
        this.url.set ( this.location.path ( ) )
      }
    } )
    this.url.set ( this.location.path ( ) )
    this.onWindowScroll ( )
  }

  public onWindowScroll ( ) {
    this.isScrolled.set ( window.scrollY > 20 )
  }

  public goTo ( routerLink: string = "", id?: string ) {
    this.isMenuCollapsed.set ( true )
    this.router.navigate ( [ routerLink ], id ? { fragment: id } : undefined )
  }

  public onDocumentClick ( event: MouseEvent ) {
    const target = event.target as HTMLElement
    if ( !target.closest ( ".mobile-menu-container" ) && !target.closest ( "button[aria-label='Toggle navigation']" ) ) {
      this.isMenuCollapsed.set ( true )
    }
  }

  public toggleMenu ( ) {
    this.isMenuCollapsed.set ( !this.isMenuCollapsed ( ) )
  }
}
