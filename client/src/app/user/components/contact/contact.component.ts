import { ChangeDetectionStrategy, Component } from "@angular/core"
import { IconComponent } from "@revive/src/app/icon/icon.component"

@Component ( {
  selector: "app-contact",
  imports: [
    IconComponent
  ],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactComponent {
}
