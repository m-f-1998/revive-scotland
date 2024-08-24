import { Component } from "@angular/core"
import { ActivatedRoute, Router } from "@angular/router"
import { FooterComponent } from "@components/footer/footer.component"
import { NavbarComponent } from "@components/navbar/navbar.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"

@Component ( {
  selector: "app-cancelled-event",
  standalone: true,
  imports: [
    NavbarComponent,
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./cancelled-event.component.html",
  styleUrl: "./cancelled-event.component.scss"
} )
export class CancelledEventComponent {
  public faCheck = faCheckCircle
  public faCross = faTimesCircle
  public success: boolean | null = null
  public failureMessage = ""

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
        this.success = success == "1" ? true : false
      }
    } )
  }

  public goHome ( ) {
    this.router.navigate ( [ "" ] )
  }
}
