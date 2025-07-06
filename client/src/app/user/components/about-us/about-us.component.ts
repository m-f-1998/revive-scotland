import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "@revive/src/app/services/icons.service"

@Component ( {
  selector: "app-about-us",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./about-us.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AboutUsComponent {
  public iconSvc: IconService = inject ( IconService )
}
