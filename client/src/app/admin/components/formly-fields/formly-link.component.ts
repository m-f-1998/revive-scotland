import { Component } from "@angular/core"
import { FieldType, FieldTypeConfig } from "@ngx-formly/core"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"

@Component({
 selector: "formly-link",
 template: `
    <div class="mb-2">
      <a href="javascript:void(0)" (click)="openFile(formControl.defaultValue)">{{ to.label }}</a>
    </div>
 `,
})
export class FormlyLink extends FieldType<FieldTypeConfig> {
  public constructor (
    private apiSvc: HttpService,
    private toastrSvc: ToastrService
  ) {
    super ( )
  }

  public openFile ( file: string ) {
    this.apiSvc.request ( "/asset.php", {
      url: file
    }, "POST" ).then ( ( blob: any ) => {
      const url = window.URL.createObjectURL ( blob )
      window.open ( url, "_blank" )
      window.URL.revokeObjectURL ( url )
    } ).catch ( e => {
      this.toastrSvc.error ( "There was an error opening the file." )
      console.error ( e )
    } )
  }
}