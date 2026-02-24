import { ChangeDetectionStrategy, Component } from "@angular/core"
import { version } from "@revive/package.json"

@Component ( {
  selector: "app-admin-footer",
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminFooterComponent {
  public currentYear = new Date ( ).getFullYear ( )
  public me = "https://matthewfrankland.co.uk/"
  public version = version
}
