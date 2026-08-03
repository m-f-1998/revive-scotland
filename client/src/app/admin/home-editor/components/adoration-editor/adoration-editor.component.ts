import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { FormGroup, FormsModule } from "@angular/forms"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { HttpHeaders } from "@angular/common/http"
import { IconComponent } from "../../../../icon/icon.component"
import { ApiService } from "../../../../services/api.service"
import { AuthService } from "../../../../services/auth.service"
import { FormlyService } from "../../../../services/formly.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { DEFAULT_ADORATION } from "../../config/home-editor.config"

@Component ( {
  selector: "app-home-adoration-editor",
  imports: [ IconComponent, FormlyForm, FormsModule ],
  templateUrl: "./adoration-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdorationEditorComponent implements OnInit {
  public form = new FormGroup ( { } )
  public model: WritableSignal<Record<string, unknown>> = signal ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]

  public saving: WritableSignal<boolean> = signal ( false )
  public loading: WritableSignal<boolean> = signal ( true )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.fields = [
      this.formlySvc.TextInput ( "title", { label: "Title", required: true, maxLength: 100 } ),
      this.formlySvc.TextAreaInput ( "body", { label: "Body Text", required: true, maxLength: 1000, includeMaxDescription: true } ),
      this.formlySvc.ImagePickerInput ( "mediaUrl", { label: "Background Media", required: true, attributes: { accept: "image/*,video/*" } } )
    ]

    this.apiSvc.get ( "/api/admin/site-content/adoration" ).then ( d => {
      const res = d as Partial<typeof DEFAULT_ADORATION>
      if ( res && res.title ) {
        this.model.set ( res as Record<string, unknown> )
      } else {
        this.model.set ( { ...DEFAULT_ADORATION } )
      }
    } ).catch ( ( ) => {
      this.model.set ( { ...DEFAULT_ADORATION } )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public onModelChange ( value: Record<string, unknown> ): void {
    this.model.set ( value )
  }

  public async save ( ): Promise<void> {
    this.saving.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/site-content/adoration", this.model ( ), new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.form.markAsPristine ( )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.set ( false )
    }
  }

  public restoreDefaults ( ): void {
    this.model.set ( { ...DEFAULT_ADORATION } )
    this.form.markAsDirty ( )
  }
}
