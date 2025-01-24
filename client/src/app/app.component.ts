import { ChangeDetectionStrategy, Component, HostListener } from "@angular/core"
import { RouterOutlet } from "@angular/router"
import { NavbarComponent } from "./user/components/navbar/navbar.component"

@Component ( {
  selector: "app-root",
  imports: [
    RouterOutlet,
    NavbarComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AppComponent {

  @HostListener ( "window:scroll", [ "$event.target" ] ) public onScroll ( ) {
    const element = document.getElementById ( "scrollTop" )
    if ( window.scrollY >= 1000 ) {
      if ( element ) element.classList.add ( "visible" )
    } else {
      if ( element ) element.classList.remove ( "visible" )
    }
  }

}
