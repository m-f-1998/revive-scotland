import { ChangeDetectionStrategy, Component } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"

@Component ( {
  selector: "app-admin-file-explorer",
  imports: [
    AdminNavbarComponent
  ],
  templateUrl: "./file-explorer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FileExplorerComponent {
}