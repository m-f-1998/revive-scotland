import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router, RouterOutlet } from "@angular/router"
import { FaConfig, FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "./services/icons.service"
import { AuthService } from "./services/auth.service"

@Component ( {
  selector: "app-root",
  imports: [
    RouterOutlet,
    FaIconComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(window:scroll)": "onScroll()"
  }
} )
export class AppComponent implements OnInit {
  public currentPath: WritableSignal<string> = signal ( window.location.pathname )

  public readonly iconSvc: IconService = inject ( IconService )
  public readonly authSvc: AuthService = inject ( AuthService )
  public readonly router: Router = inject ( Router )
  private readonly faConfig: FaConfig = inject ( FaConfig )

  public constructor ( ) {
    // Listen for changes to the route
    this.router.events.subscribe ( event => {
      if ( event instanceof NavigationEnd ) {
        this.currentPath.set ( this.router.url )
      }
    } )
    this.faConfig.autoAddCss = false
  }

  public ngOnInit ( ) {
    this.currentPath.set ( this.router.url )
  }

  public onScroll ( ) {
    const element = document.getElementById ( "scrollTop" )
    if ( window.scrollY >= 1000 ) {
      if ( element ) element.classList.add ( "visible" )
    } else {
      if ( element ) element.classList.remove ( "visible" )
    }
  }

  public scrollToTop ( ) {
    requestAnimationFrame ( ( ) => {
      document.getElementById ( "revivescotland" )?.scrollIntoView ( { behavior: "smooth" } )
    } )
  }
}
