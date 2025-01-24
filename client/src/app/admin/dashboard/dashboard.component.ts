import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core"
import { AdminService } from "@services/AdminService.service"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { DatesService } from "@services/DateService.service"
import { AdminEventsComponent } from "../events/events.component"
import { AdminPoliciesComponent } from "../policies/policies.component"
import { AdminRegistrationsComponent } from "../registrations/registrations.component"
import { Router } from "@angular/router"

@Component ( {
  selector: "app-admin-dashboard",
  imports: [
    AdminEventsComponent,
    AdminPoliciesComponent,
    AdminRegistrationsComponent
  ],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminDashboardComponent {
  public loading: WritableSignal<boolean> = signal ( true )
  public faSpinner = faSpinner
  public activeTab: WritableSignal<number> = signal ( 0 )

  public constructor (
    public adminSvc: AdminService,
    public dateSvc: DatesService,
    private router: Router
  ) { }

  public setActiveTab ( tab: number ) {
    this.activeTab.set ( tab )
  }

  public logout ( ) {
    this.adminSvc.logout ( )
    sessionStorage.removeItem ( "token" )
    this.router.navigate ( [ "/" ] )
  }

}
