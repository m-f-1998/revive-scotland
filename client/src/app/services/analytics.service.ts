import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"
import { DashboardData } from "../interfaces/analytics.interface"

@Injectable ( {
  providedIn: "root"
} )
export class AnalyticsService {
  private readonly apiSvc: ApiService = inject ( ApiService )
  private lastUpdate: Date | null = null
  private cache: DashboardData | null = null

  public async getDashboardData ( forceRefresh: boolean = false ): Promise<DashboardData> {
    const now = new Date ( )

    // If we have cached data and it's recent (within 1 day), return it
    if ( this.cache && this.lastUpdate && !forceRefresh ) {
      const diff = ( now.getTime ( ) - this.lastUpdate.getTime ( ) ) / ( 1000 * 60 * 60 * 24 )
      if ( diff < 1 ) {
        return this.cache
      }
    }

    this.cache = await this.getData ( )
    this.lastUpdate = now
    return this.cache
  }

  private getData ( ): Promise<DashboardData> {
    return this.apiSvc.get ( "/admin/analytics" ) as Promise<DashboardData>
  }
}