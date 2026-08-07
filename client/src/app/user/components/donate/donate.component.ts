import { ChangeDetectionStrategy, Component } from "@angular/core"
import { getActiveDonationStripeLink } from "../../../shared/donation-links"

@Component ( {
  selector: "app-donate",
  templateUrl: "./donate.component.html",
  styleUrl: "./donate.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DonateComponent {
  public get stripeLink ( ): string {
    return getActiveDonationStripeLink ( )
  }
}


