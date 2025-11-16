import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"
import { DashboardData } from "../interfaces/analytics.interface"
import { AuthService } from "./auth.service"
import { HttpHeaders } from "@angular/common/http"

@Injectable ( {
  providedIn: "root"
} )
export class AnalyticsService {
  private lastUpdate: Date | null = null
  private cache: DashboardData | null = null

  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly apiSvc: ApiService = inject ( ApiService )

  public async getDashboardData ( forceRefresh: boolean = false ): Promise<DashboardData> {
    const now = new Date ( )

    if ( !this.authSvc.currentUser ( ) ) {
      throw new Error ( "User not authenticated" )
    }

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

  private async getData ( ): Promise<DashboardData> {
    if ( !this.authSvc.currentUser ( ) ) {
      throw new Error ( "User not authenticated" )
    }

    return this.apiSvc.get ( "/api/admin/analytics", { }, new HttpHeaders ( {
      "Authorization": `Bearer ${ await this.authSvc.currentUser ( )?.getIdToken ( ) }`
    } ) ) as Promise<DashboardData>
  }
}