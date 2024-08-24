import { Component } from "@angular/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { ToastrService } from "ngx-toastr"
import { AdminService } from "@services/AdminService.service"
import { Router } from "@angular/router"
import { HttpService } from "@services/HttpService.service"

@Component ( {
  selector: "app-admin-login",
  standalone: true,
  imports: [
    FormsModule,
    FormlyModule,
    ReactiveFormsModule,
    FaIconComponent
  ],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss"
} )
export class AdminLoginComponent {

  public model = { }
  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]

  public loggingIn = false
  public faSpinner = faSpinner

  public constructor (
    private httpClient: HttpService,
    private toastrSvc: ToastrService,
    private adminSvc: AdminService,
    private router: Router
  ) {
    this.fields = [
      {
        key: "username",
        type: "input",
        props: {
          label: "Username",
          type: "text",
          placeholder: "Enter your username",
          required: true,
          attributes: {
            autocomplete: "current-username"
          }
        }
      },
      {
        key: "password",
        type: "input",
        props: {
          label: "Password",
          type: "password",
          placeholder: "Enter your password",
          required: true,
          minLength: 15,
          attributes: {
            autocomplete: "current-password"
          }
        }
      }
    ]
  }

  public login ( ) {
    this.loggingIn = true
    this.httpClient.request ( "/login.php", this.model, "POST" ).then ( ( res: any ) => {
      this.adminSvc.loggedIn = true
      this.adminSvc.token = res.jwt
      localStorage.setItem ( "token", res.jwt )
      this.adminSvc.user = res.user
      this.loggingIn = false
      this.router.navigate ( [ "/admin/dashboard" ] )
    } ).catch ( e => {
      if ( e.status === 401 ) {
        this.toastrSvc.error ( "Invalid Username or Password" )
      } else {
        this.toastrSvc.error ( e.error )
      }
      this.loggingIn = false
      console.error ( e )
    } )
  }

}
