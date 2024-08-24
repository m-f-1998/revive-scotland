import { Component } from '@angular/core';
import { AdminService } from '@services/AdminService.service';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { DatesService } from '@services/DateService.service';
import { AdminEventsComponent } from '../events/events.component';
import { AdminPoliciesComponent } from '../policies/policies.component';
import { AdminRegistrationsComponent } from '../registrations/registrations.component';
import { Router } from '@angular/router';

@Component ( {
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    AdminEventsComponent,
    AdminPoliciesComponent,
    AdminRegistrationsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
} )
export class AdminDashboardComponent {
  public loading = true
  public faSpinner = faSpinner
  public activeTab = 0

  public constructor (
    public adminSvc: AdminService,
    public dateSvc: DatesService,
    private router: Router
  ) { }

  public setActiveTab ( tab: number ) {
    this.activeTab = tab
  }

  public logout ( ) {
    this.adminSvc.logout ( )
    sessionStorage.removeItem ( "token" )
    this.router.navigate ( [ "/" ] )
  }

}
