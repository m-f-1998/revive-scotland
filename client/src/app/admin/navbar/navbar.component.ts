import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router } from "@angular/router"
import { AuthService } from "../../services/auth.service"
import { IconComponent } from "../../icon/icon.component"

const CONTENT_ROUTES = [ "/admin/homeEditor", "/admin/eventEditor", "/admin/testimonialsEditor", "/admin/contactEditor", "/admin/storyEditor", "/admin/galleryEditor" ]

@Component ( {
  selector: "app-admin-navbar",
  imports: [ IconComponent ],
  templateUrl: "./navbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:click)": "onDocumentClick($event)"
  }
} )
export class AdminNavbarComponent implements OnInit {
  public url: WritableSignal<string> = signal ( "" )
  public isMenuCollapsed: WritableSignal<boolean> = signal ( true )
  public isContentDropdownOpen: WritableSignal<boolean> = signal ( false )
  public readonly isContentActive = computed ( ( ) => CONTENT_ROUTES.includes ( this.url ( ) ) )

  public readonly location: Location = inject ( Location )
  private readonly router: Router = inject ( Router )
  private readonly authSvc: AuthService = inject ( AuthService )

  public ngOnInit ( ) {
    this.router.events.subscribe ( event => {
      if ( event instanceof NavigationEnd ) {
        this.url.set ( this.location.path ( ) )
        this.isContentDropdownOpen.set ( false )
      }
    } )
    this.url.set ( this.location.path ( ) )
  }

  public onDocumentClick ( event: MouseEvent ) {
    const target = event.target as HTMLElement
    if ( !target.closest ( ".dropdown-container" ) ) {
      this.isContentDropdownOpen.set ( false )
    }
  }

  public toggleContentDropdown ( event: MouseEvent ) {
    event.stopPropagation ( )
    this.isContentDropdownOpen.set ( !this.isContentDropdownOpen ( ) )
  }

  public goTo ( routerLink: string = "", id?: string ) {
    this.isMenuCollapsed.set ( true )
    this.isContentDropdownOpen.set ( false )
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
