import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "@revive/src/app/services/icons.service"

@Component ( {
  selector: "app-contact",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactComponent {
  public readonly iconSvc: IconService = inject ( IconService )
}
