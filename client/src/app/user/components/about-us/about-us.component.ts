import { ChangeDetectionStrategy, Component } from "@angular/core"
import { IconComponent } from "@revive/src/app/icon/icon.component"

@Component ( {
  selector: "app-about-us",
  imports: [
    IconComponent
  ],
  templateUrl: "./about-us.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AboutUsComponent {
}
