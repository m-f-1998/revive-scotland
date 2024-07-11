import { Component } from "@angular/core"

@Component ( {
  selector: "app-navbar",
  standalone: true,
  imports: [ ],
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.scss"
} )
export class NavbarComponent {
  public scrollTo ( id: string ) {
    document.querySelector ( id )?.scrollIntoView ( { behavior: "smooth" } )
  }
}
