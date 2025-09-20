import { NgOptimizedImage } from "@angular/common"
import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-adoration-missions",
  imports: [
    NgOptimizedImage
  ],
  templateUrl: "./adoration-missions.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdorationMissionsComponent {
  public title = "Adoration Missions"

  public goToContact ( ) {
    const element = document.getElementById ( "contact" )
    if ( element ) {
      element.scrollIntoView ( { behavior: "smooth" } )
    }
  }
}
