import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { FieldType, FieldTypeConfig } from "@ngx-formly/core"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Component ( {
  selector: "app-file-input",
  imports: [ ],
  templateUrl: "./file-input.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FileInputComponent extends FieldType<FieldTypeConfig> {
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public fileSelected ( $event: Event ) {
    const inputElement = $event.target as HTMLInputElement
    const files: File [ ] = Array.from ( inputElement.files ?? [ ] )
    for ( const file of files ) {
      const acceptedTypes = ( this.props?.attributes?. [ "accept" ] ?? "" ) as string
      const maxSize = ( this.props.attributes?. [ "max-size" ] ?? 0 ) as number

      if ( !acceptedTypes.split ( "," ).some ( type => file.type === type ) ) {
        this.toastrSvc.error ( "The Selected File Type is Not Allowed", "File Upload Failed" )
        this.formControl.setValue ( [ ] )
        inputElement.value = ""
        return
      }

      if ( maxSize && file.size / 1000 / 1000 > maxSize ) {
        this.toastrSvc.error ( "The Selected File is Too Large", "File Upload Failed" )
        this.formControl.setValue ( [ ] )
        inputElement.value = ""
        return
      }
    }
    this.formControl.setValue ( files )
  }
}