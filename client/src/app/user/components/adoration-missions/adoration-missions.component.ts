import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-adoration-missions",
  templateUrl: "./adoration-missions.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdorationMissionsComponent {
  public img = "assets/img/adoration.jpg"

  public goToContact ( ) {
    const element = document.getElementById ( "contact" )
    if ( element ) {
      element.scrollIntoView ( { behavior: "smooth" } )
    }
  }
}
