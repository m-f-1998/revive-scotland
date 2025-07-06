import { ChangeDetectionStrategy, Component, HostListener, inject } from "@angular/core"
import { RouterOutlet } from "@angular/router"
import { NavbarComponent } from "./user/components/navbar/navbar.component"
import { FaConfig, FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "./services/icons.service"

@Component ( {
  selector: "app-root",
  imports: [
    RouterOutlet,
    NavbarComponent,
    FaIconComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AppComponent {
  public readonly iconSvc: IconService = inject ( IconService )

  private readonly faConfig = inject ( FaConfig )

  public constructor ( ) {
    this.faConfig.autoAddCss = false
  }

  @HostListener ( "window:scroll", [ "$event.target" ] ) public onScroll ( ) {
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
