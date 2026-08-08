import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AuthService } from "../../services/auth.service"
import { BaseChartDirective } from "ng2-charts"
import { DashboardData, OverviewMetrics } from "../../interfaces/analytics.interface"
import { AnalyticsService } from "../../services/analytics.service"
import { ChartData, ChartOptions } from "chart.js"
import { DecimalPipe, DatePipe, CurrencyPipe, UpperCasePipe } from "@angular/common"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { ApiService } from "../../services/api.service"
import { HttpHeaders } from "@angular/common/http"

@Component ( {
  selector: "app-admin-dashboard",
  imports: [
    AdminNavbarComponent,
    IconComponent,
    BaseChartDirective,
    DecimalPipe,
    DatePipe,
    CurrencyPipe,
    UpperCasePipe,
    AdminFooterComponent
  ],
  templateUrl: "./dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DashboardComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public dashboardData: WritableSignal<DashboardData | null> = signal ( null )
  public donations: WritableSignal<Array<Record<string, unknown>>> = signal ( [ ] )

  public overview: OverviewMetrics = {
    activeUsers: 0,
    sessions: 0,
    avgSessionDuration: 0,
    engagementRate: "0%",
    conversions: 0
  }

  public readonly pageSize = 10
  public geoPage: WritableSignal<number> = signal ( 0 )
  public trafficPage: WritableSignal<number> = signal ( 0 )
  public donationsPage: WritableSignal<number> = signal ( 0 )

  public readonly paginatedGeoData = computed ( ( ) => {
    const data = this.dashboardData ( )?.geographyData || [ ]
    const start = this.geoPage ( ) * this.pageSize
    return data.slice ( start, start + this.pageSize )
  } )

  public readonly hasMoreGeo = computed ( ( ) => {
    const data = this.dashboardData ( )?.geographyData || [ ]
    return ( this.geoPage ( ) + 1 ) * this.pageSize < data.length
  } )

  public readonly paginatedTrafficData = computed ( ( ) => {
    const data = this.dashboardData ( )?.trafficSourceData || [ ]
    const start = this.trafficPage ( ) * this.pageSize
    return data.slice ( start, start + this.pageSize )
  } )

  public readonly hasMoreTraffic = computed ( ( ) => {
    const data = this.dashboardData ( )?.trafficSourceData || [ ]
    return ( this.trafficPage ( ) + 1 ) * this.pageSize < data.length
  } )

  public readonly paginatedDonations = computed ( ( ) => {
    const data = this.donations ( )
    const start = this.donationsPage ( ) * this.pageSize
    return data.slice ( start, start + this.pageSize )
  } )

  public readonly hasMoreDonations = computed ( ( ) => {
    return ( this.donationsPage ( ) + 1 ) * this.pageSize < this.donations ( ).length
  } )

  public trendChartData: ChartData<"line"> = { labels: [ ], datasets: [ ] }
  public trendChartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    elements: { line: { tension: 0.4 } }, // Smooth lines
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Daily Active Users & Sessions" },
      tooltip: { animation: { duration: 500 } } // Basic hover/tooltip animation
    },
    scales: {
      x: { title: { display: true, text: "Date" } },
      y: { title: { display: true, text: "Count" }, beginAtZero: true }
    }
  }

  public deviceChartData: ChartData<"doughnut", number[], string> = { labels: [ ], datasets: [ ] }
  public deviceChartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" },
      title: { display: true, text: "Sessions by Device" },
      tooltip: { animation: { duration: 500 } }
    }
  }

  public readonly authSvc: AuthService = inject ( AuthService )
  private readonly analyticsSvc: AnalyticsService = inject ( AnalyticsService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    Promise.all ( [
      this.analyticsSvc.getDashboardData ( ).then ( data => {
        this.dashboardData.set ( data )
        this.overview = data.overview

        this.prepareTrendChartData ( data )
        this.prepareDeviceChartData ( data )
      } ).catch ( error => {
        console.error ( "Error loading dashboard data:", error )
        this.toastrSvc.error ( "Failed to load dashboard data. Please try again later." )
      } ),
      this.loadDonations ( )
    ] ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public nextGeoPage ( ): void {
    if ( this.hasMoreGeo ( ) ) this.geoPage.update ( p => p + 1 )
  }

  public prevGeoPage ( ): void {
    if ( this.geoPage ( ) > 0 ) this.geoPage.update ( p => p - 1 )
  }

  public nextTrafficPage ( ): void {
    if ( this.hasMoreTraffic ( ) ) this.trafficPage.update ( p => p + 1 )
  }

  public prevTrafficPage ( ): void {
    if ( this.trafficPage ( ) > 0 ) this.trafficPage.update ( p => p - 1 )
  }

  public nextDonationsPage ( ): void {
    if ( this.hasMoreDonations ( ) ) this.donationsPage.update ( p => p + 1 )
  }

  public prevDonationsPage ( ): void {
    if ( this.donationsPage ( ) > 0 ) this.donationsPage.update ( p => p - 1 )
  }

  /**
   * Safe navigation wrapper for template to avoid syntax errors
   * when authSvc.currentUser( ) might be undefined before async checks complete.
   */
  public $safeNavigationMigration ( value: unknown ): unknown {
    return value
  }

  private async loadDonations ( ) {
    try {
      const res = await this.apiSvc.get ( "/api/admin/donations", {}, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) ) as { donations: Array<Record<string, unknown>> }
      this.donations.set ( res.donations )
    } catch {
      this.toastrSvc.error ( "Failed to load recent donations." )
    }
  }

  private prepareTrendChartData ( data: DashboardData ): void {
    const labels = data.trendData.map ( d => this.formatDateLabel ( d.date ) )
    const activeUsers = data.trendData.map ( d => d.activeUsers )
    const sessions = data.trendData.map ( d => d.sessions )

    this.trendChartData = {
      labels: labels,
      datasets: [
        {
          data: activeUsers,
          label: "Active Users",
          borderColor: "#0d6efd", // Bootstrap primary blue
          backgroundColor: "rgba(13, 110, 253, 0.2)",
          fill: true,
          pointRadius: 3,
        },
        {
          data: sessions,
          label: "Sessions",
          borderColor: "#198754", // Bootstrap success green
          backgroundColor: "rgba(25, 135, 84, 0.1)",
          fill: true,
          pointRadius: 3,
        }
      ]
    }
  }

  private prepareDeviceChartData ( data: DashboardData ): void {
    const labels = data.deviceData.map ( d => d.deviceCategory )
    const sessions = data.deviceData.map ( d => d.sessions )

    this.deviceChartData = {
      labels: labels,
      datasets: [
        {
          data: sessions,
          label: "Sessions",
          backgroundColor: [ "#0d6efd", "#198754", "#ffc107" ], // Blue, Green, Yellow
          hoverOffset: 10, // Subtle hover animation
        }
      ]
    }
  }

  private formatDateLabel ( date: number ): string {
    const dateStrPadded = date.toString ( ).padStart ( 8, "0" )
    // const year = dateStrPadded.substring ( 0, 4 )
    const month = dateStrPadded.substring ( 4, 6 )
    const day = dateStrPadded.substring ( 6, 8 )
    return `${month}/${day}`
  }
}