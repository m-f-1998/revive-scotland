import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { ActivatedRoute, Router } from "@angular/router"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { IconComponent } from "../../icon/icon.component"

const ERROR_MAP: Record<string, { title: string; description: string }> = {
  "400": { title: "Bad Request",           description: "The request couldn't be understood by the server." },
  "401": { title: "Unauthorised",          description: "You're not authorised to view this page." },
  "403": { title: "Access Denied",         description: "You don't have permission to access this page." },
  "404": { title: "Page Not Found",        description: "The page you're looking for doesn't exist or has been moved." },
  "500": { title: "Internal Server Error", description: "Something went wrong on our end. Please try again shortly." },
}

@Component ( {
  selector: "app-error",
  imports: [
    NavbarComponent,
    FooterComponent,
    IconComponent
  ],
  templateUrl: "./error.component.html",
  styleUrl: "./error.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ErrorComponent {
  public code: string
  public title: string
  public description: string

  private readonly route: ActivatedRoute = inject ( ActivatedRoute )
  private readonly router: Router = inject ( Router )

  public constructor ( ) {
    let code = this.route.snapshot.paramMap.get ( "code" ) ?? "500"
    if ( isNaN ( Number ( code ) ) ) {
      code = "404"
      this.router.navigate ( [ "/error/404" ] )
    }
    const entry = ERROR_MAP [ code ] ?? ERROR_MAP [ "500" ]
    this.code = code in ERROR_MAP ? code : "500"
    this.title = entry.title
    this.description = entry.description
  }
}