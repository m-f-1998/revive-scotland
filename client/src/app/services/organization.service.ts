import { inject, Service } from "@angular/core"
import { ApiService } from "./api.service"
import { AdminOrganization, PublicOrganization } from "../interfaces/organization.interface"
import { AuthService } from "./auth.service"
import { HttpHeaders } from "@angular/common/http"

@Service ( )
export class OrganizationService {
  private readonly apiSvc = inject ( ApiService )
  private readonly authSvc = inject ( AuthService )

  public async getPublicOrganization ( slug: string ): Promise<PublicOrganization | undefined> {
    try {
      const res = await this.apiSvc.get ( `/api/organizations/${encodeURIComponent ( slug )}/public` ) as {
        organization: PublicOrganization
      }
      return res.organization
    } catch {
      return undefined
    }
  }

  public async listAdminOrganizations ( ): Promise<AdminOrganization [ ]> {
    const res = await this.apiSvc.get ( "/api/admin/organizations", { }, await this.authHeaders ( ) ) as {
      organizations: AdminOrganization [ ]
    }
    return res.organizations || [ ]
  }

  public async createOrganization ( payload: Record<string, unknown> ): Promise<{
    organization: AdminOrganization
    bookingUrl: string
    onboardingUrl: string | null
  }> {
    return this.apiSvc.post ( "/api/admin/organizations", payload, await this.authHeaders ( ) ) as Promise<{
      organization: AdminOrganization
      bookingUrl: string
      onboardingUrl: string | null
    }>
  }

  public async updateOrganization ( id: string, payload: Record<string, unknown> ): Promise<{
    organization: AdminOrganization
    bookingUrl: string | null
  }> {
    return this.apiSvc.patch ( `/api/admin/organizations/${encodeURIComponent ( id )}`, payload, await this.authHeaders ( ) ) as Promise<{
      organization: AdminOrganization
      bookingUrl: string | null
    }>
  }

  public async startConnectOnboarding ( id: string ): Promise<{ url: string; accountId: string }> {
    return this.apiSvc.post (
      `/api/admin/organizations/${encodeURIComponent ( id )}/connect/onboarding`,
      { },
      await this.authHeaders ( )
    ) as Promise<{ url: string; accountId: string }>
  }

  public async syncConnectStatus ( id: string ): Promise<{ chargesEnabled: boolean }> {
    return this.apiSvc.post (
      `/api/admin/organizations/${encodeURIComponent ( id )}/connect/sync`,
      { },
      await this.authHeaders ( )
    ) as Promise<{ chargesEnabled: boolean }>
  }

  public bookingPath ( slug: string, opts?: { eventId?: string; returnUrl?: string; embed?: boolean } ): string {
    const params = new URLSearchParams ( )
    if ( opts?.returnUrl ) params.set ( "return", opts.returnUrl )
    if ( opts?.embed ) params.set ( "embed", "1" )
    if ( opts?.eventId ) params.set ( "eventId", opts.eventId )
    const qs = params.toString ( )
    return `/book/${encodeURIComponent ( slug )}${qs ? `?${qs}` : ""}`
  }

  private async authHeaders ( ): Promise<HttpHeaders> {
    const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
    return new HttpHeaders ( { Authorization: `Bearer ${token}` } )
  }
}
