import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"
import { FileService } from "../../services/file.service"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { File } from "../../interfaces/file.interface"
import { FormlyService } from "../../services/formly.service"
import { DatePipe } from "@angular/common"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"

@Component ( {
  selector: "app-upload",
  imports: [
    NavigationBarComponent,
    DatePipe,
    FaIconComponent
  ],
  templateUrl: "./upload.component.html",
  styleUrl: "./upload.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class UploadComponent {
  public files: WritableSignal<File[]> = signal<File[]> ( [ ] )
  public loading: WritableSignal<boolean> = signal<boolean> ( true )
  public newUploadFields : FormlyFieldConfig [ ] = [ ]

  public readonly iconSvc: IconService = inject ( IconService )
  public readonly fileSvc: FileService = inject ( FileService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )

  public constructor ( ) {
    this.fileSvc.getFiles ( ).then ( files => {
      this.files.set ( files || [ ] )

      this.newUploadFields = [
        this.formlySvc.FileInput ( "file", {
          label: "Select File",
          required: true,
          description: "Max file size: 5.5MB. Allowed types: PDF, PNG, JPG, JPEG.",
          attributes: {
            accept: ".pdf,.png,.jpg,.jpeg"
          }
        } )
      ]
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public async newFile ( ): Promise<void> {

  }
}