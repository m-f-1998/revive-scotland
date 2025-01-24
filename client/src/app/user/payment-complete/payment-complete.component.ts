import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core"
import { ActivatedRoute, Router } from "@angular/router"
import { FooterComponent } from "@components/footer/footer.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"

@Component ( {
  selector: "app-payment-complete",
  imports: [
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./payment-complete.component.html",
  styleUrl: "./payment-complete.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PaymentCompleteComponent {
  public faCheck = faCheckCircle
  public faCross = faTimesCircle
  public success: WritableSignal<boolean> = signal ( false )
  public message: WritableSignal<string> = signal ( "" )

  public constructor (
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    this.activatedRoute.queryParams.subscribe ( params => {
      const success = params [ "success" ]
      if ( success ) {
        if ( params [ "message" ] ) {
          this.message = params [ "message" ]
        }
        this.success.set ( success == "1" ? true : false )
      }
    } )
  }

  public goHome ( ) {
    this.router.navigate ( [ "" ] )
  }
}
