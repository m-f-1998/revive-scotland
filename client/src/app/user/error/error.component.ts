import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { ActivatedRoute, Router } from "@angular/router"
import { AuthService } from "../../services/auth.service"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "app-error",
  imports: [
    NavbarComponent,
    IconComponent
  ],
  templateUrl: "./error.component.html",
  styleUrl: "./error.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ErrorComponent {
  public error = "500 Internal Server Error"
  public description = "Something went wrong."
  public imagePath = "skye/skye-4.jpg"

  public readonly authSvc: AuthService = inject ( AuthService )
  private readonly route: ActivatedRoute = inject ( ActivatedRoute )
  private readonly router: Router = inject ( Router )

  public constructor ( ) {
    this.error = this.route.snapshot.paramMap.get ( "code" ) ?? "500"
    if ( isNaN ( Number ( this.error ) ) ) {
      this.error = "404"
      this.router.navigate ( [ "/error/404" ] )
    }
    const code = Number ( this.error )
    this.error = "HTTP Status " + this.error

    switch ( code ) {
      case 400:
        this.description = "Something's Not Right With The Request"
        break
      case 401:
        this.description = "Client Not Authorized"
        break
      case 403:
        this.description = "Access Denied"
        break
      case 404:
        this.description = "Page Not Found"
        break
      default:
        this.description = "Something Went Wrong"
        break
    }
  }
}