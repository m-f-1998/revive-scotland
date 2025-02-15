import { ChangeDetectionStrategy, Component, HostListener } from "@angular/core"
import { RouterOutlet } from "@angular/router"
import { NavbarComponent } from "./user/components/navbar/navbar.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faArrowUpLong } from "@fortawesome/free-solid-svg-icons"

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

  public faArrowUp = faArrowUpLong

  @HostListener ( "window:scroll", [ "$event.target" ] ) public onScroll ( ) {
    const element = document.getElementById ( "scrollTop" )
    if ( window.scrollY >= 1000 ) {
      if ( element ) element.classList.add ( "visible" )
    } else {
      if ( element ) element.classList.remove ( "visible" )
    }
  }

}
