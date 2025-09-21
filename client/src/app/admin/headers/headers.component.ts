import { ChangeDetectionStrategy, Component } from "@angular/core"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"

@Component ( {
  selector: "app-headers",
  imports: [
    NavigationBarComponent
  ],
  templateUrl: "./headers.component.html",
  styleUrl: "./headers.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class HeadersComponent {

}