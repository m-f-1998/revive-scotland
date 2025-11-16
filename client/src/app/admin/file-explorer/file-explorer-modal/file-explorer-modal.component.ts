import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FileEntry } from "@revive/src/app/interfaces/fileExplorer.interface"
import { FormlyService } from "@revive/src/app/services/formly.service"

@Component ( {
  selector: "app-admin-file-explorer-modal",
  imports: [ FormlyForm ],
  templateUrl: "./file-explorer-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FileExplorerModalComponent implements OnInit {
  @Input ( ) public type: "delete" | "rename" | "createFolder" = "createFolder"
  @Input ( ) public name: string = ""
  @Input ( ) public isFolder: boolean = false
  @Input ( { required: true } ) public file: FileEntry
  @Input ( { required: true } ) public userS3Path: string
  @Input ( { required: true } ) public currentPath: string

  public form: FormGroup = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]
  public model: any = { }

  private readonly activeModal: NgbActiveModal = inject ( NgbActiveModal )
  private readonly formlySvc: FormlyService = inject ( FormlyService )

  public get completeClass ( ): string {
    switch ( this.type ) {
      case "delete":
        return "btn btn-danger"
      case "rename":
        return "btn btn-primary"
      case "createFolder":
        return "btn btn-success"
    }
  }

  public ngOnInit ( ): void {
    if ( this.type === "rename" ) {
      this.fields = [
        this.formlySvc.TextInput ( "rename", {
          label: "New Name / Destination Path (relative to root)",
          placeholder: this.isFolder ? "e.g., documents/new-folder/" : "e.g., documents/new-file.txt",
        } )
      ]
    } else if ( this.type === "createFolder" ) {
      this.fields = [
        this.formlySvc.TextInput ( "folderName", {
          label: "Folder Name",
          description: this.currentPath,
          placeholder: "e.g., new-project/",
        } )
      ]
    }
  }

  public completeAction ( ): void {
    if ( this.type === "delete" ) {
      this.deleteFileOrFolder ( )
    } else if ( this.type === "rename" ) {
      this.renameFileOrFolder ( ) // Replace "" with actual new name input
    } else if ( this.type === "createFolder" ) {
      this.createFolder ( ) // Replace "" with actual folder name input
    }
  }

  public dismiss ( reason?: string ): void {
    this.activeModal.dismiss ( reason )
  }

  public close ( result: any ): void {
    this.activeModal.close ( result )
  }

  public createFolder ( ) {
    if ( !this.model?.folderName?.trim ( ) ) {
      this.dismiss ( "Folder name cannot be empty." )
      return
    }

    this.close ( this.model )

    // this.loading.set ( true )
    // this.closeModal ( )

    // if ( !key.endsWith ( "/" ) ) { key += "/" }

    // const fullKey = this.userS3Path + key

    // try {
    //   await this.apiSvc.post ( `${this.baseRoute}/create-folder`, {
    //     key: fullKey
    //   } )
    //   this.listPath ( this.currentPath ( ) )
    //   this.loading.set ( false )
    // } catch ( err: any ) {
    //   console.error ( "Create folder error:", err )
    //   this.errorMessage.set ( `Failed to create folder: ${err.error?.message || err.message}` )
    //   this.loading.set ( false )
    // }
  }

  public deleteFileOrFolder ( ) {
    // this.loading.set ( true )
    // this.closeModal ( )

    this.close ( this.model )

    // try {
    //   await this.apiSvc.post ( `${this.baseRoute}/delete`, {
    //     key: file.key,
    //     isFolder: file.isFolder
    //   } )
    // } catch ( err: any ) {
    //   console.error ( "Delete error:", err )
    //   this.errorMessage.set ( `Failed to delete resource: ${err.error?.message || err.message}` )
    //   this.loading.set ( false )
    // }
  }

  public renameFileOrFolder ( ) {
    if ( !this.model.rename.trim ( ) ) {
      this.dismiss ( "New key cannot be empty." )
      return
    }

    this.close ( this.model )
    // this.loading.set ( true )
    // this.closeModal ( )

    // let finalNewRelativeKey = newRelativeKey.trim ( )

    // if ( file.isFolder && !finalNewRelativeKey.endsWith ( "/" ) ) {
    //   finalNewRelativeKey += "/"
    // }

    // const newKey = this.userS3Path + finalNewRelativeKey

    // try {
    //   await this.apiSvc.post ( `${this.baseRoute}/rename`, {
    //     oldKey: file.key,
    //     newKey: newKey,
    //     isFolder: file.isFolder
    //   } )
    //   this.listPath ( this.currentPath ( ) )
    //   this.loading.set ( false )
    // } catch ( err: any ) {
    //   console.error ( "Rename error:", err )
    //   this.errorMessage.set ( `Failed to rename/move: ${err.error?.message || err.message}` )
    //   this.loading.set ( false )
    // }
  }
}