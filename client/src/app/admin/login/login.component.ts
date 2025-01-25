import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { ToastrService } from "ngx-toastr"
import { AdminService } from "@services/AdminService.service"
import { Router } from "@angular/router"
import { ApiService } from "@services/api.service"

@Component ( {
  selector: "app-admin-login",
  imports: [
    FormsModule,
    FormlyModule,
    ReactiveFormsModule,
    FaIconComponent
  ],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminLoginComponent {

  public model = { }
  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]

  public loggingIn: WritableSignal<boolean> = signal ( false )
  public faSpinner = faSpinner

  public constructor (
    private apiSvc: ApiService,
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
    this.loggingIn.set ( true )
    this.apiSvc.request ( "/login.php", this.model, "POST" ).then ( ( res: any ) => {
      this.adminSvc.loggedIn.set ( true )
      this.adminSvc.token = res.jwt
      localStorage.setItem ( "token", res.jwt )
      this.adminSvc.user = res.user
      this.loggingIn.set ( false )
      this.router.navigate ( [ "/admin/dashboard" ] )
    } ).catch ( e => {
      if ( e.status === 401 ) {
        this.toastrSvc.error ( "Invalid Username or Password" )
      } else {
        this.toastrSvc.error ( e.error )
      }
      this.loggingIn.set ( false )
      console.error ( e )
    } )
  }

}
