import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from "@angular/core"
import { AbstractControl, FormGroup } from "@angular/forms"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { FileEntry } from "@revive/src/app/interfaces/fileExplorer.interface"
import { FormlyService } from "@revive/src/app/services/formly.service"

@Component ( {
  selector: "app-admin-file-explorer-modal",
  imports: [
    FormlyForm,
    IconComponent
  ],
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
  public model: Record<string, unknown> = { }

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
      let defaultValue = this.file.name
      if ( !this.isFolder ) {
        const lastDotIndex = this.file.name.lastIndexOf ( "." )
        if ( lastDotIndex > 0 ) {
          defaultValue = this.file.name.slice ( 0, lastDotIndex )
        }
      }
      this.fields = [
        this.formlySvc.TextInput ( "rename", {
          label: "New Name for " + ( this.isFolder ? "Folder" : "File" ),
          placeholder: "e.g., new-name.txt"
        }, {
          defaultValue,
          validators: {
            validFilename: {
              expression: ( c: AbstractControl ) => {
                const value: string = c.value as string || ""
                const invalidChars = /[\\\/:*?"<>|]/ // Common invalid filename characters
                return !invalidChars.test ( value )
              },
              message: ( ) => `The name contains invalid characters (\\ / : * ? " < > |).`
            }
          }
        } )
      ]
    } else if ( this.type === "createFolder" ) {
      this.fields = [
        this.formlySvc.TextInput ( "folderName", {
          label: "Folder Name",
          description: this.currentPath,
          placeholder: "e.g., new-project/",
        }, {
          validators: {
            validFolderName: {
              expression: ( c: AbstractControl ) => {
                const value: string = c.value as string || ""
                const invalidChars = /[\\\/:*?"<>|]/ // Common invalid folder name characters
                return !invalidChars.test ( value ) && !value.endsWith ( "/" )
              },
              message: ( ) => `The folder name contains invalid characters (\\ / : * ? " < > |) or ends with a slash (/).`
            }
          }
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

  public close ( result: Record<string, unknown> ): void {
    this.activeModal.close ( result )
  }

  public createFolder ( ) {
    if ( !( this.model?. [ "folderName" ] as string ?? "" ).trim ( ) ) {
      this.dismiss ( "Folder name cannot be empty." )
      return
    }

    this.close ( this.model )
  }

  public deleteFileOrFolder ( ) {
    this.close ( this.model )
  }

  public renameFileOrFolder ( ) {
    if ( !( this.model?. [ "rename" ] as string ?? "" ).trim ( ) ) {
      this.dismiss ( "New key cannot be empty." )
      return
    }

    this.close ( this.model )
  }
}