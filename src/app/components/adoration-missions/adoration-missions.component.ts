import { Component } from "@angular/core"

@Component ( {
  selector: "app-adoration-missions",
  standalone: true,
  imports: [],
  templateUrl: "./adoration-missions.component.html",
  styleUrl: "./adoration-missions.component.scss"
} )
export class AdorationMissionsComponent {

  public img = "img/adoration.jpg"

  goToContact ( ) {
    const element = document.getElementById ( "contact" )
    if ( element ) {
      element.scrollIntoView ( { behavior: "smooth" } )
    }
  }
}
