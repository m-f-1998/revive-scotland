import { Component } from "@angular/core"
import { ActivatedRoute } from "@angular/router"
import { FooterComponent } from "@components/footer/footer.component"
import { NavbarComponent } from "@components/navbar/navbar.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"

@Component ( {
  selector: "app-payment-complete",
  standalone: true,
  imports: [
    NavbarComponent,
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./payment-complete.component.html",
  styleUrl: "./payment-complete.component.scss"
} )
export class PaymentCompleteComponent {
  public faCheck = faCheckCircle
  public faCross = faTimesCircle
  public success: boolean | null = null

  public constructor (
    private activatedRoute: ActivatedRoute
  ) {
    this.activatedRoute.queryParams.subscribe ( params => {
      const success = params [ "success" ]
      if ( success ) {
        this.success = success == "1" ? true : false
      }
    } )
  }
}
