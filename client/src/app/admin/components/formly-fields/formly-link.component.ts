import { ChangeDetectionStrategy, Component } from "@angular/core"
import { FieldType, FieldTypeConfig } from "@ngx-formly/core"
import { ApiService } from "@services/api.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-formly-link",
  template: `
    <div class="mb-2">
      <a href="javascript:void(0)" (click)="openFile(formControl.defaultValue)">{{ to.label }}</a>
    </div>
 `,
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FormlyLinkComponent extends FieldType<FieldTypeConfig> {
  public constructor (
    private apiSvc: ApiService,
    private toastrSvc: ToastrService
  ) {
    super ( )
  }

  public openFile ( file: string ) {
    this.apiSvc.request ( "/asset.php", {
      url: file
    } ).then ( ( blob: any ) => {
      const url = window.URL.createObjectURL ( blob )
      window.open ( url, "_blank" )
      window.URL.revokeObjectURL ( url )
    } ).catch ( e => {
      if ( e.status === 401 ) {
        this.toastrSvc.error ( "You are not authorized to view this file." )
      } else if ( e.status === 404 ) {
        this.toastrSvc.error ( "The file could not be found." )
      } else if ( e.status === 415 ) {
        this.toastrSvc.error ( "The file is not in a supported format." )
      } else {
        this.toastrSvc.error ( "There was an error opening the file." )
      }
      console.error ( e )
    } )
  }
}