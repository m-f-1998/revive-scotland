import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { OrganizationService } from "../../services/organization.service"
import { AdminOrganization } from "../../interfaces/organization.interface"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AuthService } from "../../services/auth.service"
import { ApiService } from "../../services/api.service"
import { HttpHeaders } from "@angular/common/http"

interface OrganisationDraft {
  name: string
  websiteUrl: string
  adminEmails: string[]
  platformFeePercent: string
  fixedFeePounds: string
  buttonColor: string
  paymentNote: string
  enabled: boolean
}

interface NewOrganisation {
  id: string
  slug: string
  name: string
  websiteUrl: string
  adminEmails: string[]
  platformFeePercent: string
  fixedFeePounds: string
  buttonColor: string
  paymentNote: string
}

const emptyNewOrganisation = ( ): NewOrganisation => ( {
  id: "",
  slug: "",
  name: "",
  websiteUrl: "",
  adminEmails: [ ],
  platformFeePercent: "1.5",
  fixedFeePounds: "0.20",
  buttonColor: "",
  paymentNote: ""
} )

const draftFromOrganisation = ( org: AdminOrganization ): OrganisationDraft => ( {
  name: org.name,
  websiteUrl: org.websiteUrl || "",
  adminEmails: [ ...new Set ( ( org.adminEmails || [ ] ).map ( email => email.trim ( ).toLowerCase ( ) ).filter ( Boolean ) ) ],
  platformFeePercent: String ( org.platformFeePercent ?? 0 ),
  fixedFeePounds: ( ( org.platformFeeFixedPence ?? 0 ) / 100 ).toFixed ( 2 ),
  buttonColor: org.primaryColor || "",
  paymentNote: org.tagline || "",
  enabled: org.enabled !== false
} )

const feeProblem = ( percent: number, pounds: number ): string => {
  if ( !Number.isFinite ( percent ) || percent < 0 || percent > 100 ) return "Platform fee must be between 0 and 100."
  if ( !Number.isFinite ( pounds ) || pounds < 0 ) return "Fixed fee must be zero or more."
  return ""
}

@Component ( {
  selector: "app-organizations-admin",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent ],
  templateUrl: "./organizations.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class OrganizationsAdminComponent implements OnInit {
  public readonly loading = signal ( true )
  public readonly organizations: WritableSignal<AdminOrganization [ ]> = signal ( [ ] )
  public readonly drafts = signal<Record<string, OrganisationDraft>> ( { } )
  public readonly isSuperAdmin = signal ( false )
  public readonly newOrg = signal<NewOrganisation> ( emptyNewOrganisation ( ) )
  public readonly query = signal ( "" )
  public readonly openId = signal<string | null> ( null )
  public readonly adding = signal ( false )
  public readonly visible = computed ( ( ) => {
    const term = this.query ( ).trim ( ).toLowerCase ( )
    const orgs = this.organizations ( )
    if ( !term ) return orgs
    return orgs.filter ( org =>
      org.name.toLowerCase ( ).includes ( term ) || org.slug.toLowerCase ( ).includes ( term )
    )
  } )

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
      const orgs = await this.orgSvc.listAdminOrganizations ( )
      this.organizations.set ( orgs )
      const drafts: Record<string, OrganisationDraft> = { }
      for ( const org of orgs ) drafts [ org.id ] = draftFromOrganisation ( org )
      this.drafts.set ( drafts )
    } catch {
      this.toastrSvc.error ( "Could not load organisations." )
    } finally {
      this.loading.set ( false )
    }
  }

  public toggle ( id: string ): void {
    this.adding.set ( false )
    this.openId.set ( this.openId ( ) === id ? null : id )
  }

  public showAdd ( ): void {
    this.adding.update ( open => !open )
    if ( this.adding ( ) ) this.openId.set ( null )
  }

  public feeLabel ( org: AdminOrganization ): string {
    const draft = this.drafts ( ) [ org.id ]
    const percent = draft?.platformFeePercent || "0"
    const pounds = draft?.fixedFeePounds || "0.00"
    return `${percent}% + £${pounds}`
  }

  public connectStatusLabel ( org: AdminOrganization ): string {
    if ( org.stripeConnectPayoutsEnabled || org.stripeConnectChargesEnabled ) return "Payouts enabled"
    if ( org.stripeConnectAccountId ) return "Finish setup"
    if ( org.stripeDevReady ) return "Test account"
    return "Available"
  }

  public connectStatusHint ( org: AdminOrganization ): string {
    if ( org.stripeConnectPayoutsEnabled || org.stripeConnectChargesEnabled ) {
      return "Payments for this parish go to their Stripe account. Revive keeps the fee set below on each payment."
    }
    if ( org.stripeConnectAccountId ) {
      return "Stripe account created. They still need to finish setup before paid events can go live."
    }
    if ( org.stripeDevReady ) {
      return "Revive takes the card payment on the local test account. Set up parish payouts when their share should go to their own bank account. Revive keeps the fee above."
    }
    return "Revive takes the card payment. Set up parish payouts so their share is sent on automatically. Revive keeps the fee above."
  }

  public text ( event: Event ): string {
    return ( event.target as HTMLInputElement | HTMLTextAreaElement ).value
  }

  public checked ( event: Event ): boolean {
    return ( event.target as HTMLInputElement ).checked
  }

  public patchDraft ( id: string, patch: Partial<OrganisationDraft> ): void {
    const current = this.drafts ( ) [ id ]
    if ( !current ) return
    this.drafts.set ( { ...this.drafts ( ), [ id ]: { ...current, ...patch } } )
  }

  public patchDraftNumber ( id: string, key: "platformFeePercent" | "fixedFeePounds", event: Event ): void {
    this.patchDraft ( id, { [ key ]: ( event.target as HTMLInputElement ).value } )
  }

  public patchNew ( patch: Partial<NewOrganisation> ): void {
    this.newOrg.set ( { ...this.newOrg ( ), ...patch } )
  }

  public patchNewNumber ( key: "platformFeePercent" | "fixedFeePounds", event: Event ): void {
    this.patchNew ( { [ key ]: ( event.target as HTMLInputElement ).value } )
  }

  public addDraftEmail ( id: string, input: HTMLInputElement ): void {
    const current = this.drafts ( ) [ id ]
    if ( !current ) return
    const next = this.withEmail ( current.adminEmails, input.value )
    if ( !next ) return
    this.patchDraft ( id, { adminEmails: next } )
    input.value = ""
  }

  public removeDraftEmail ( id: string, email: string ): void {
    const current = this.drafts ( ) [ id ]
    if ( !current ) return
    this.patchDraft ( id, { adminEmails: current.adminEmails.filter ( item => item !== email ) } )
  }

  public addNewEmail ( input: HTMLInputElement ): void {
    const next = this.withEmail ( this.newOrg ( ).adminEmails, input.value )
    if ( !next ) return
    this.patchNew ( { adminEmails: next } )
    input.value = ""
  }

  public removeNewEmail ( email: string ): void {
    this.patchNew ( { adminEmails: this.newOrg ( ).adminEmails.filter ( item => item !== email ) } )
  }

  public async saveOrganisation ( org: AdminOrganization ): Promise<void> {
    const draft = this.drafts ( ) [ org.id ]
    if ( !draft?.name.trim ( ) ) {
      this.toastrSvc.warning ( "A display name is required." )
      return
    }
    const problem = feeProblem ( Number ( draft.platformFeePercent ), Number ( draft.fixedFeePounds ) )
    if ( problem ) {
      this.toastrSvc.warning ( problem )
      return
    }
    if ( draft.buttonColor.trim ( ) && !/^#[0-9A-Fa-f]{6}$/.test ( draft.buttonColor.trim ( ) ) ) {
      this.toastrSvc.warning ( "Button colour must be a hex colour such as #6e2430." )
      return
    }
    try {
      await this.orgSvc.updateOrganization ( org.id, {
        name: draft.name.trim ( ),
        websiteUrl: draft.websiteUrl.trim ( ),
        enabled: draft.enabled,
        adminEmails: draft.adminEmails,
        platformFeePercent: Number ( draft.platformFeePercent ),
        platformFeeFixedPence: Math.round ( Number ( draft.fixedFeePounds ) * 100 ),
        primaryColor: draft.buttonColor.trim ( ),
        tagline: draft.paymentNote.trim ( )
      } )
      this.toastrSvc.success ( "Organisation saved." )
      await this.load ( )
    } catch {
      this.toastrSvc.error ( "Could not save this organisation." )
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
    const draft = this.newOrg ( )
    if ( !draft.id.trim ( ) || !draft.slug.trim ( ) || !draft.name.trim ( ) ) {
      this.toastrSvc.warning ( "Document id, slug, and name are required." )
      return
    }
    const problem = feeProblem ( Number ( draft.platformFeePercent ), Number ( draft.fixedFeePounds ) )
    if ( problem ) {
      this.toastrSvc.warning ( problem )
      return
    }
    if ( draft.buttonColor.trim ( ) && !/^#[0-9A-Fa-f]{6}$/.test ( draft.buttonColor.trim ( ) ) ) {
      this.toastrSvc.warning ( "Button colour must be a hex colour such as #6e2430." )
      return
    }
    try {
      const res = await this.orgSvc.createOrganization ( {
        id: draft.id.trim ( ),
        slug: draft.slug.trim ( ).toLowerCase ( ),
        name: draft.name.trim ( ),
        websiteUrl: draft.websiteUrl.trim ( ),
        adminEmails: draft.adminEmails,
        platformFeePercent: Number ( draft.platformFeePercent ),
        platformFeeFixedPence: Math.round ( Number ( draft.fixedFeePounds ) * 100 ),
        primaryColor: draft.buttonColor.trim ( ),
        tagline: draft.paymentNote.trim ( ),
        enabled: true
      } )
      this.toastrSvc.success ( "Organisation created." )
      this.newOrg.set ( emptyNewOrganisation ( ) )
      if ( res.onboardingUrl ) {
        window.location.href = res.onboardingUrl
        return
      }
      await this.load ( )
      if ( res.bookingUrl ) {
        await navigator.clipboard.writeText ( res.bookingUrl )
        this.toastrSvc.info ( "Booking link copied." )
      }
    } catch {
      this.toastrSvc.error ( "Could not create the organisation." )
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
    } catch ( error ) {
      const record = error as { error?: { error?: string } }
      this.toastrSvc.error ( record.error?.error || "Could not start payout setup." )
    }
  }

  public async syncStripe ( org: AdminOrganization ): Promise<void> {
    try {
      const status = await this.orgSvc.syncConnectStatus ( org.id )
      this.toastrSvc.success ( status.chargesEnabled ? "Payouts are enabled." : "Payout setup is not finished." )
      await this.load ( )
    } catch {
      this.toastrSvc.error ( "Could not refresh the payout status." )
    }
  }

  private withEmail ( current: string [ ], raw: string ): string [ ] | null {
    const email = raw.trim ( ).toLowerCase ( )
    if ( !email.includes ( "@" ) || !email.includes ( "." ) ) {
      this.toastrSvc.warning ( "Enter an email address." )
      return null
    }
    if ( current.includes ( email ) ) return current
    return [ ...current, email ]
  }
}
