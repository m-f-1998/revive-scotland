import { ChangeDetectionStrategy, Component } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"

@Component ( {
  selector: "app-admin-event-editor",
  imports: [
    AdminNavbarComponent
  ],
  templateUrl: "./event-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventEditorComponent {
}