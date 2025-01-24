import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core"
import { ActivatedRoute, Router } from "@angular/router"
import { FooterComponent } from "@components/footer/footer.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"

@Component ( {
  selector: "app-cancelled-event",
  imports: [
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./cancelled-event.component.html",
  styleUrl: "./cancelled-event.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class CancelledEventComponent {
  public faCheck = faCheckCircle
  public faCross = faTimesCircle
  public success: WritableSignal<boolean | null> = signal ( null )
  public failureMessage: WritableSignal<string> = signal ( "" )

  public constructor (
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    this.activatedRoute.queryParams.subscribe ( params => {
      const success = params [ "success" ]
      if ( success ) {
        if ( success == "0" ) {
          this.failureMessage = params [ "error" ]
        }
        this.success.set ( success == "1" ? true : false )
      }
    } )
  }

  public goHome ( ) {
    this.router.navigate ( [ "" ] )
  }
}
