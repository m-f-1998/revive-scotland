import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-donate",
  templateUrl: "./donate.component.html",
  styleUrl: "./donate.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DonateComponent {
  public get stripeLink ( ): string {
    const hostname = window.location.hostname
    if ( hostname === "localhost" || hostname === "dev.revivescotland.co.uk" ) {
      return "https://buy.stripe.com/test_aFa8wPdN4bRw3Wz02m7ss00"
    }
    return "https://donate.stripe.com/00w9AT9Reb7maMrenU3wQ00"
  }
}


