import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router, RouterOutlet } from "@angular/router"
import { FaConfig } from "@fortawesome/angular-fontawesome"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { filter } from "rxjs/operators"
import { AuthService } from "./services/auth.service"
import { IconComponent } from "./icon/icon.component"
import { applyRecaptchaTestFromUrl } from "./shared/recaptcha-test"

@Component ( {
  selector: "app-root",
  imports: [
    RouterOutlet,
    IconComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(window:scroll)": "onScroll( )"
  }
} )
export class AppComponent implements OnInit {
  public currentPath: WritableSignal<string> = signal ( window.location.pathname )

  public readonly authSvc: AuthService = inject ( AuthService )
  public readonly router: Router = inject ( Router )
  private readonly faConfig: FaConfig = inject ( FaConfig )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public constructor ( ) {
    this.router.events.pipe ( filter ( event => event instanceof NavigationEnd ) ).subscribe ( ( ) => {
      this.currentPath.set ( this.router.url )
      applyRecaptchaTestFromUrl ( this.router, this.toastrSvc )
    } )
    this.faConfig.autoAddCss = false
  }

  public ngOnInit ( ) {
    this.currentPath.set ( this.router.url )
    applyRecaptchaTestFromUrl ( this.router, this.toastrSvc )
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
