import { ChangeDetectionStrategy, Component } from "@angular/core"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"

@Component ( {
  selector: "app-upload",
  imports: [
    NavigationBarComponent
  ],
  templateUrl: "./upload.component.html",
  styleUrl: "./upload.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class UploadComponent {

}