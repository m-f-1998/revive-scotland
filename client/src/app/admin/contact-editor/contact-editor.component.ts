import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { FormlyService } from "../../services/formly.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"

@Component ( {
  selector: "app-admin-contact-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, FormlyForm ],
  templateUrl: "./contact-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public form = new FormGroup ( { } )
  public model: Record<string, unknown> = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.fields = [
      this.formlySvc.TelInput ( "phone", {
        label: "Phone Number",
        placeholder: "+447883824055",
        required: true
      } ),
      this.formlySvc.EmailInput ( "email", {
        label: "Email Address",
        placeholder: "luca@revivescotland.co.uk",
        required: true
      } ),
      this.formlySvc.TextInput ( "instagram", {
        label: "Instagram Handle",
        placeholder: "revive.scotland",
        required: true,
        maxLength: 100
      } )
    ]

    this.apiSvc.get ( "/api/admin/contact-details" ).then ( data => {
      this.model = data as Record<string, unknown>
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to load contact details." )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public async save ( ): Promise<void> {
    if ( this.form.invalid ) {
      this.toastrSvc.error ( "Please fix validation errors before saving." )
      return
    }

    this.loading.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/contact-details", this.model, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Contact details saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save contact details." )
    } finally {
      this.loading.set ( false )
    }
  }
}
