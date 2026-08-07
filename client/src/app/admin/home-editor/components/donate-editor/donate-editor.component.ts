import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { IconComponent } from "../../../../icon/icon.component"
import { QrDownloadComponent } from "../../../../shared/qr-download/qr-download.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import {
  DONATION_STRIPE_LINK_LIVE,
  DONATION_STRIPE_LINK_TEST,
  getActiveDonationStripeLink
} from "../../../../shared/donation-links"

@Component ( {
  selector: "app-home-donate-editor",
  imports: [ IconComponent, QrDownloadComponent ],
  templateUrl: "./donate-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DonateEditorComponent {
  public readonly liveLink = DONATION_STRIPE_LINK_LIVE
  public readonly testLink = DONATION_STRIPE_LINK_TEST
  public readonly activePublicLink = getActiveDonationStripeLink ( )

  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public copyLink ( url: string, label: string ): void {
    navigator.clipboard.writeText ( url ).then ( ( ) => {
      this.toastrSvc.success ( `${label} copied to clipboard.` )
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to copy link." )
    } )
  }
}
