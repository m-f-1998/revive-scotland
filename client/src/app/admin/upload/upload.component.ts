import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"
import { FileService } from "../../services/file.service"
import { FormlyFieldConfig } from "@ngx-formly/core"
// import { DBFile, FileNode } from "../../interfaces/file.interface"
import { FormlyService } from "../../services/formly.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
// import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { FileBrowserComponent } from "./file-browser/file-browser.component"

@Component ( {
  selector: "app-upload",
  imports: [
    NavigationBarComponent,
    FaIconComponent,
    FileBrowserComponent
  ],
  templateUrl: "./upload.component.html",
  styleUrl: "./upload.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class UploadComponent {
  public loading: WritableSignal<boolean> = signal<boolean> ( true )
  public newUploadFields : FormlyFieldConfig [ ] = [ ]

  public readonly iconSvc: IconService = inject ( IconService )
  public readonly fileSvc: FileService = inject ( FileService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  // private readonly modalSvc: NgbModal = inject ( NgbModal )

  public constructor ( ) {
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
    this.loading.set ( false )
  }

  // public async shareFile ( file: DBFile ): Promise<void> {
  //   try {
  //     const share = await this.fileSvc.createShare ( file.id, {
  //       expiresAt: new Date ( Date.now () + 7 * 24 * 60 * 60 * 1000 ).toISOString (), // default 7 days
  //       maxDownloads: 5
  //     } )
  //     alert ( `Share link created:\n${window.location.origin}/share/${share.token}` )
  //   } catch ( err ) {
  //     alert ( "Failed to create share link" )
  //     console.error ( "Failed to create share link", err )
  //   }
  // }
}