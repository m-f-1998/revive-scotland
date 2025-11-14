import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AuthService } from "../../services/auth.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"

@Component ( {
  selector: "app-admin-dashboard",
  imports: [
    AdminNavbarComponent,
    FaIconComponent
  ],
  templateUrl: "./dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DashboardComponent {
  public readonly adminSvc: AuthService = inject ( AuthService )
  public readonly iconSvc: IconService = inject ( IconService )
}