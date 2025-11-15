import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AuthService } from "../../services/auth.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { BaseChartDirective } from "ng2-charts"
import { DashboardData, OverviewMetrics } from "../../interfaces/analytics.interface"
import { AnalyticsService } from "../../services/analytics.service"
import { ChartData, ChartOptions } from "chart.js"
import { DecimalPipe } from "@angular/common"

@Component ( {
  selector: "app-admin-dashboard",
  imports: [
    AdminNavbarComponent,
    FaIconComponent,
    BaseChartDirective,
    DecimalPipe
  ],
  templateUrl: "./dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DashboardComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public dashboardData: DashboardData | null = null

  public overview!: OverviewMetrics

  // --- Chart Properties ---
  // 1. Line Chart (Trend Data)
  public trendChartData!: ChartData<"line">
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

  // 2. Doughnut Chart (Device Data)
  public deviceChartData!: ChartData<"doughnut", number[], string>
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
  public readonly adminSvc: AuthService = inject ( AuthService )
  public readonly iconSvc: IconService = inject ( IconService )
  private readonly analyticsSvc: AnalyticsService = inject ( AnalyticsService )

  public ngOnInit ( ): void {
    this.analyticsSvc.getDashboardData ( ).then ( data => {
      this.dashboardData = data
      this.overview = data.overview

      this.prepareTrendChartData ( data )
      this.prepareDeviceChartData ( data )
    } ).catch ( error => {
      console.error ( "Error loading dashboard data:", error )
      this.loading.set ( false )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
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