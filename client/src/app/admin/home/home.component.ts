import { ChangeDetectionStrategy, Component } from "@angular/core"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"

@Component ( {
  selector: "app-home",
  imports: [
    NavigationBarComponent
  ],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class HomeComponent {

}