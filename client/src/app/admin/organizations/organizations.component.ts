import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { OrganizationService } from "../../services/organization.service"
import { AdminOrganization } from "../../interfaces/organization.interface"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { FormsModule } from "@angular/forms"
import { AuthService } from "../../services/auth.service"
import { ApiService } from "../../services/api.service"
import { HttpHeaders } from "@angular/common/http"

@Component ( {
  selector: "app-organizations-admin",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, FormsModule ],
  templateUrl: "./organizations.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class OrganizationsAdminComponent implements OnInit {
  public readonly loading = signal ( true )
  public readonly organizations: WritableSignal<AdminOrganization [ ]> = signal ( [ ] )
  public readonly isSuperAdmin = signal ( false )

  public newOrg = {
    id: "",
    slug: "",
    name: "",
    websiteUrl: "",
    platformFeePercent: 2.5,
    platformFeeFixedPence: 50
  }

  private readonly orgSvc = inject ( OrganizationService )
  private readonly toastrSvc = inject ( ToastrService )
  private readonly authSvc = inject ( AuthService )
  private readonly apiSvc = inject ( ApiService )

  public ngOnInit ( ): void {
    void this.load ( )
  }

  public async load ( ): Promise<void> {
    this.loading.set ( true )
    try {
      const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
      const verify = await this.apiSvc.get ( "/api/admin/verify", { }, new HttpHeaders ( {
        Authorization: `Bearer ${token}`
      } ) ) as { role?: string }
      this.isSuperAdmin.set ( verify?.role === "superadmin" )
      this.organizations.set ( await this.orgSvc.listAdminOrganizations ( ) )
    } catch {
      this.toastrSvc.error ( "Could not load organizations." )
    } finally {
      this.loading.set ( false )
    }
  }

  public connectStatusLabel ( org: AdminOrganization ): string {
    if ( org.stripeConnectPayoutsEnabled || org.stripeConnectChargesEnabled ) return "Payouts enabled"
    if ( org.stripeConnectAccountId ) return "Finish onboarding"
    return "Not connected"
  }

  public connectStatusHint ( org: AdminOrganization ): string {
    if ( org.stripeConnectPayoutsEnabled || org.stripeConnectChargesEnabled ) {
      return "Donations for this partner go to their Stripe account. Revive can take a platform fee on each payment."
    }
    if ( org.stripeConnectAccountId ) {
      return "Stripe account created, but they still need to finish onboarding before paid events can go live."
    }
    return "Connect Stripe before publishing required or optional donation events for this partner."
  }

  public feePounds ( org: AdminOrganization ): number {
    return ( org.platformFeeFixedPence ?? 0 ) / 100
  }

  public setFeePounds ( org: AdminOrganization, pounds: number ): void {
    const n = Number ( pounds )
    org.platformFeeFixedPence = Number.isFinite ( n ) ? Math.round ( n * 100 ) : 0
  }

  public async saveFees ( org: AdminOrganization ): Promise<void> {
    try {
      await this.orgSvc.updateOrganization ( org.id, {
        platformFeePercent: Number ( org.platformFeePercent ?? 0 ),
        platformFeeFixedPence: Number ( org.platformFeeFixedPence ?? 0 )
      } )
      this.toastrSvc.success ( "Fees saved." )
      await this.load ( )
    } catch {
      this.toastrSvc.error ( "Could not save fees." )
    }
  }

  public bookingLink ( org: AdminOrganization, eventId?: string ): string {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}${this.orgSvc.bookingPath ( org.slug, {
      returnUrl: org.websiteUrl,
      embed: true,
      eventId
    } )}`
  }

  public embedSnippet ( org: AdminOrganization ): string {
    const url = this.bookingLink ( org )
    return `<a href="${url}" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.25rem;border-radius:9999px;background:#1d4ed8;color:#fff;font-weight:600;text-decoration:none;">Book an event</a>`
  }

  public async createOrg ( ): Promise<void> {
    if ( !this.newOrg.id.trim ( ) || !this.newOrg.slug.trim ( ) || !this.newOrg.name.trim ( ) ) {
      this.toastrSvc.warning ( "Id, slug, and name are required." )
      return
    }
    try {
      const res = await this.orgSvc.createOrganization ( {
        id: this.newOrg.id.trim ( ),
        slug: this.newOrg.slug.trim ( ).toLowerCase ( ),
        name: this.newOrg.name.trim ( ),
        websiteUrl: this.newOrg.websiteUrl.trim ( ) || null,
        platformFeePercent: this.newOrg.platformFeePercent,
        platformFeeFixedPence: this.newOrg.platformFeeFixedPence,
        enabled: true
      } )
      this.toastrSvc.success ( "Organization created." )
      this.newOrg = { id: "", slug: "", name: "", websiteUrl: "", platformFeePercent: 2.5, platformFeeFixedPence: 50 }
      await this.load ( )
      if ( res.bookingUrl ) {
        await navigator.clipboard.writeText ( res.bookingUrl )
        this.toastrSvc.info ( "Full booking URL copied to clipboard." )
      }
    } catch {
      this.toastrSvc.error ( "Failed to create organization." )
    }
  }

  public async copyText ( text: string, label: string ): Promise<void> {
    try {
      await navigator.clipboard.writeText ( text )
      this.toastrSvc.success ( `${label} copied.` )
    } catch {
      this.toastrSvc.error ( "Copy failed." )
    }
  }

  public async connectStripe ( org: AdminOrganization ): Promise<void> {
    try {
      const { url } = await this.orgSvc.startConnectOnboarding ( org.id )
      window.location.href = url
    } catch {
      this.toastrSvc.error ( "Could not start Stripe Connect onboarding." )
    }
  }

  public async syncStripe ( org: AdminOrganization ): Promise<void> {
    try {
      const status = await this.orgSvc.syncConnectStatus ( org.id )
      this.toastrSvc.success ( status.chargesEnabled ? "Stripe charges enabled." : "Stripe onboarding still pending." )
      await this.load ( )
    } catch {
      this.toastrSvc.error ( "Could not sync Stripe status." )
    }
  }
}
