import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormlyService } from "@services/formly.service"
import { ApiService } from "../../services/api.service"
import { Router } from "@angular/router"
import { ApplicationService } from "../../services/application.service"

@Component ( {
  selector: "app-login",
  imports: [
    FormlyForm
  ],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class LoginComponent {
  public form: FormGroup = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]
  public model: any = { }

  public loading: WritableSignal<boolean> = signal ( false )

  public error: string | null = null

  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly router: Router = inject ( Router )
  private readonly appSvc: ApplicationService = inject ( ApplicationService )

  public constructor ( ) {
    this.fields = [
      this.formlySvc.TextInput ( "username", {
        label: "Username",
        placeholder: "Enter your username",
        required: true
      } ),
      this.formlySvc.PasswordInput ( "password", {
        label: "Password",
        placeholder: "Enter your password",
        required: true
      } )
    ]

    this.apiSvc.post ( "/auth/verify" ).then ( ( ) => {
      this.router.navigate ( [ "/admin/events" ] )
    } ).catch ( ( ) => {
      this.appSvc.setLogout ( )
    } )
  }

  public submit ( ): void {
    if ( this.form.invalid ) return
    this.loading.set ( true )
    this.error = null
    this.apiSvc.post ( "/auth/login", {
      username: this.model.username,
      password: this.model.password
    } ).then ( ( { token }: any ) => {
      this.appSvc.setLogin ( token )
      this.router.navigate ( [ "/admin/events" ] )
    } ).catch ( err => {
      this.error = err?.error?.message || "An error occurred"
      this.loading.set ( false )
    } )
  }
}