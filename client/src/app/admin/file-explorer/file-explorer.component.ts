import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Signal, signal, viewChild, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AuthService } from "../../services/auth.service"
import { FileEntry, Quota } from "../../interfaces/fileExplorer.interface"
import { FileExplorerService } from "../../services/fileExplorer.service"
import { ApiService } from "../../services/api.service"
import { NgbDropdownModule, NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { FileExplorerModalComponent } from "./file-explorer-modal/file-explorer-modal.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { DatePipe } from "@angular/common"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { HttpErrorResponse, HttpHeaders } from "@angular/common/http"
import { FormlyService } from "../../services/formly.service"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"

@Component ( {
  selector: "app-admin-file-explorer",
  imports: [
    AdminNavbarComponent,
    DatePipe,
    FaIconComponent,
    NgbDropdownModule
  ],
  templateUrl: "./file-explorer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FileExplorerComponent {
  public readonly authSvc: AuthService = inject ( AuthService )
  public readonly fileExplorerSvc: FileExplorerService = inject ( FileExplorerService )
  public readonly iconSvc: IconService = inject ( IconService )

  public readonly fileInput: Signal<ElementRef<HTMLInputElement> | undefined> = viewChild ( "fileInput" )

  public readonly userS3Path = `users/${this.authSvc.currentUser ( )?.uid || ""}/`

  public loading: WritableSignal<boolean> = signal ( false )
  public currentPath: WritableSignal<string> = signal ( "" ) // Relative path: '' or 'documents/images/'
  public fileList: WritableSignal<FileEntry[]> = signal<FileEntry[]> ( [] )
  public quota: WritableSignal<Quota> = signal<Quota> ( { used: 0, max: 1073741824, remaining: 0 } ) // Default 1GB max

  public breadcrumbs = computed ( ( ) => this.fileExplorerSvc.formatPathToBreadcrumbs ( this.currentPath ( ) ) )

  private draggedFile: FileEntry | null = null

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  private readonly baseRoute = "/api/admin/file-explorer"

  public constructor ( ) {
    effect ( ( ) => {
      this.listPath ( this.currentPath ( ) )
      this.fetchQuota ( )
    } )
  }

  public async listPath ( relativePath: string = "" ) {
    this.loading.set ( true )
    this.currentPath.set ( relativePath )

    const path = relativePath || "/"

    try {
      const formattedData = ( await this.fileExplorerSvc.getFilesInFolder ( path ) ).map ( item => ( {
        ...item,
        isFolder: item.isFolder ? true : false,
        lastModified: item.lastModified ? new Date ( item.lastModified ) : undefined
      } ) )
      this.fileList.set ( formattedData )
      this.loading.set ( false )
    } catch ( err: any ) {
      console.error ( "List error:", err )
      this.toastrSvc.error ( "Failed to load directory" )
      this.loading.set ( false )
    }
  }

  public async fetchQuota ( ) {
    try {
      const response = await this.apiSvc.get ( `${this.baseRoute}/quota`, { }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as Quota
      this.quota.set ( data )
    } catch ( err ) {
      console.error ( "Quota fetch error:", err )
    }
  }

  public navigateTo ( folderName: string ) {
    const newPath = this.currentPath ( ) + folderName + "/"
    this.listPath ( newPath )
  }

  public goUp ( ) {
    const path = this.currentPath ( )
    const parts = path.split ( "/" ).filter ( p => p.length > 0 )
    parts.pop ( )
    const newPath = parts.length > 0 ? parts.join ( "/" ) + "/" : ""
    this.listPath ( newPath )
  }

  public async viewFile ( key: string ) {
    this.loading.set ( true )
    try {
      const response = await this.apiSvc.get ( `${this.baseRoute}/view-url`, { key }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as { viewUrl: string }
      window.open ( data.viewUrl, "_blank" )
      this.loading.set ( false )
    } catch ( err: any ) {
      console.error ( "View file error:", err )
      this.toastrSvc.error ( "Failed to view file" )
      this.loading.set ( false )
    }
  }

  public async shareFile ( key: string ) {
    const fileName = key.replace ( this.userS3Path, "" ).split ( "/" ).pop ( ) || "file"

    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true,
      backdrop: "static",
      size: "md"
    } )
    modalRef.componentInstance.fields = [
      this.formlySvc.SelectInput ( "expiry", {
        label: "Link Expiry",
        required: true,
        options: [
          { label: "1 Hour", value: 3600 },
          { label: "6 Hours", value: 21600 },
          { label: "12 Hours", value: 43200 },
          { label: "24 Hours", value: 86400 }
        ]
      }, {
        defaultValue: 86400
      } )
    ]
    modalRef.componentInstance.title = "Generate Shareable Link"
    modalRef.componentInstance.body =`Select options for the shareable link to: <strong>${fileName}</strong>`
    modalRef.componentInstance.confirmText = "Generate Link"
    modalRef.componentInstance.cancelText = "Cancel"
    await modalRef.result.then ( async ( model: { expiry: number } ) => {
      this.loading.set ( true )
      try {
        const expiry = model.expiry || 86400
        const response = await this.apiSvc.post ( `${this.baseRoute}/share-url`, {
          key,
          expiresIn: expiry
        }, new HttpHeaders ( {
          "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
        } ) )
        const data = response as { shareUrl: string }

        await navigator.clipboard.writeText ( data.shareUrl )

        this.toastrSvc.success ( "Share URL copied to clipboard! (Link expires in 24 hours)" )
      } catch ( err: any ) {
        console.error ( "Share file error:", err )
        this.toastrSvc.error ( "Failed to generate share URL" )
      }
    } ).catch ( ( ) => { } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  // --- Upload Flow ---
  public async onFileSelected ( event: Event ) {
    const input = event.target as HTMLInputElement
    const file = input.files
    const tasks = [ ]
    const uploadSize = Array.from ( file || [ ] ).reduce ( ( acc, f ) => acc + f.size, 0 )

    if ( uploadSize > this.quota ( ).remaining ) {
      this.toastrSvc.error ( "Upload would exceed your storage quota. Please delete some files and try again." )
      return
    }

    let overwriteAll = false
    const filesAtPathCache: Record<string, FileEntry[]> = { }

    for ( let i = 0; i < ( file?.length || 0 ); i++ ) {
      const f = file?.item ( i )

      if ( f ) {
        if ( f.size === 0 ) {
          continue
        } else if ( f.size > 20 * 1024 * 1024 ) { // 20MB
          this.toastrSvc.error ( `File "${f.name}" is larger than 20MB and cannot be uploaded.` )
          continue
        }

        const fileName = f.webkitRelativePath || f.name
        let fileAtPath
        if ( fileName.includes ( "/" ) ) {
          const pathParts = fileName.split ( "/" )
          pathParts.pop ( )
          fileAtPath = this.fileExplorerSvc.sanitizeS3Key ( pathParts.join ( "/" ) + "/" )
        } else {
          fileAtPath = "/"
        }

        let filesAtPath
        if ( fileAtPath in filesAtPathCache ) {
          filesAtPath = filesAtPathCache [ fileAtPath ]
        } else {
          filesAtPath = await this.fileExplorerSvc.getFilesInFolder ( fileAtPath )
          filesAtPathCache [ fileAtPath ] = filesAtPath
        }

        const exists = filesAtPath.some ( entry => {
          const sanitizedKey = this.fileExplorerSvc.sanitizeS3Key ( f.webkitRelativePath || f.name )
          return entry.key ===  ( this.userS3Path + this.currentPath ( ) + sanitizedKey ) && !entry.isFolder
        } )

        if ( exists && !overwriteAll ) {
          const modalRef = this.modalSvc.open ( InputDialogComponent, {
            centered: true,
            backdrop: "static",
            size: "md"
          } )
          modalRef.componentInstance.title = "Overwrite Confirmation"
          modalRef.componentInstance.body = `File "<strong>${f.name}</strong>" already exists. Do you want to overwrite it?`
          modalRef.componentInstance.fields = [
            this.formlySvc.CheckboxInput ( "overwriteAll", { label: "Apply to all files", required: false } )
          ]
          modalRef.componentInstance.confirmText = "Overwrite"
          modalRef.componentInstance.cancelText = "Skip"
          let skipFile = false
          await modalRef.result.then ( ( model: { overwriteAll: boolean } ) => {
            if ( model.overwriteAll ) {
              overwriteAll = true
            }
          } ).catch ( ( ) => {
            skipFile = true
          } )
          if ( skipFile ) {
            continue
          }
        }

        tasks.push ( this.uploadFile ( f ) )
      }
    }
    Promise.all ( tasks )
    const fileInputRef = this.fileInput ( )
    if ( fileInputRef ) {
      fileInputRef.nativeElement.value = ""
    }
  }

  public openModal ( type: "createFolder" | "rename" | "delete", data: FileEntry | null = null ) {
    const modalRef = this.modalSvc.open ( FileExplorerModalComponent, {
      centered: true,
      backdrop: "static",
      size: "md"
    } )
    modalRef.componentInstance.type = type
    modalRef.componentInstance.file = data
    modalRef.componentInstance.userS3Path = this.userS3Path
    modalRef.componentInstance.currentPath = this.currentPath ( )

    modalRef.result.then ( async result => {
      // Result is the model
      this.loading.set ( true )
      if ( type === "createFolder" ) {
        let folderName: string = result?.folderName || ""
        if ( !folderName.endsWith ( "/" ) ) { folderName += "/" }

        const fullKey = this.userS3Path + this.currentPath ( ) + folderName

        // Check if folder already exists
        const filesAtPath = await this.fileExplorerSvc.getFilesInFolder ( this.currentPath ( ) )
        const exists = filesAtPath.some ( entry => {
          return entry.key ===  fullKey && entry.isFolder
        } )

        if ( exists ) {
          this.toastrSvc.error ( "Folder already exists" )
          this.loading.set ( false )
          return
        }

        try {
          await this.apiSvc.post ( `${this.baseRoute}/create-folder`, {
            key: fullKey
          }, new HttpHeaders ( {
            "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
          } ) )
          this.listPath ( this.currentPath ( ) )
        } catch ( err ) {
          console.error ( "Create folder error:", err )
          this.toastrSvc.error ( "Failed to create folder" )
        }
      } else if ( type === "delete" ) {
        try {
          await this.apiSvc.post ( `${this.baseRoute}/delete`, {
            key: data!.key,
            isFolder: data!.isFolder
          }, new HttpHeaders ( {
            "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
          } ) )
          this.listPath ( this.currentPath ( ) )
          this.fetchQuota ( )
        } catch ( err: any ) {
          console.error ( "Delete error:", err )
          this.toastrSvc.error ( "Failed to delete resource" )
        }
      } else if ( type === "rename" ) {
        let newName: string = result?.rename 
        if ( !newName ) {
          this.toastrSvc.error ( "Invalid name" )
          this.loading.set ( false )
          return
        }

        const parts = newName.split ( "/" )
        newName = parts.pop ( ) || newName

        const newKey = this.userS3Path + this.currentPath ( ) + ( data!.isFolder ? newName + "/" : newName ) + ( data!.isFolder ? "" : data!.key.slice ( data!.key.lastIndexOf ( "." ) ) )
        try {
          await this.apiSvc.post ( `${this.baseRoute}/rename`, {
            oldKey: data!.key,
            newKey: newKey,
            isFolder: data!.isFolder
          }, new HttpHeaders ( {
            "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
          } ) )
          this.listPath ( this.currentPath ( ) )
        } catch ( err ) {
          console.error ( "Rename error:", err )
          this.toastrSvc.error ( "Failed to rename/move" )
        }
      }
    } ).catch ( ( err?: string ) => {
      if ( err ) {
        this.toastrSvc.error ( err )
      }
      // Modal dismissed
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public onDragStart ( event: DragEvent, file: any ) {
    this.draggedFile = file
    event.dataTransfer?.setData ( "text/plain", file.key )
  }

  public onDragOver ( event: DragEvent ) {
    event.preventDefault ( ) // allow drop
  }

  public async upAFolder ( event: DragEvent ) {
    event.preventDefault ( )

    if ( !this.draggedFile ) return
    if ( this.currentPath ( ) === "" ) return

    this.loading.set ( true )

    const sourceKey = this.draggedFile.key
    let targetFolderKey = this.currentPath ( )
    if ( targetFolderKey.endsWith ( "/" ) ) {
      targetFolderKey = targetFolderKey.slice ( 0, -1 )
    }

    targetFolderKey = targetFolderKey.substring ( 0, targetFolderKey.lastIndexOf ( "/" ) + 1 ) // include trailing /

    const filesAtPath = await this.fileExplorerSvc.getFilesInFolder ( targetFolderKey )

    const exists = filesAtPath.some ( entry => {
      return entry.key ===  this.userS3Path + targetFolderKey + this.draggedFile!.name && !entry.isFolder
    } )

    if ( exists ) {
      const modalRef = this.modalSvc.open ( InputDialogComponent, {
        centered: true,
        backdrop: "static",
        size: "md"
      } )
      modalRef.componentInstance.title = "Overwrite Confirmation"
      modalRef.componentInstance.body = `File "<strong>${this.draggedFile.name}</strong>" already exists in the target folder. Do you want to overwrite it?`
      modalRef.componentInstance.confirmText = "Overwrite"
      modalRef.componentInstance.cancelText = "Cancel"
      let skipMove = false
      await modalRef.result.then ( async ( ) => {
        // Confirmed
      } ).catch ( ( ) => {
        skipMove = true
      } )
      if ( skipMove ) {
        this.draggedFile = null
        this.loading.set ( false )
        return
      }
    }

    try {
      await this.fileExplorerSvc.moveFile ( sourceKey, this.userS3Path + targetFolderKey )
      this.listPath ( this.currentPath ( ) )
    } catch ( err ) {
      console.error ( "Move error:", err )
      this.toastrSvc.error ( "Failed to move file" )
    } finally {
      this.draggedFile = null
      this.loading.set ( false )
    }
  }

  public async onDrop ( event: DragEvent, targetFolder: FileEntry ) {
    event.preventDefault ( )

    if ( !this.draggedFile || !targetFolder.isFolder ) return

    this.loading.set ( true )

    const sourceKey = this.draggedFile.key
    const targetKey = targetFolder.key

    const targetFolderPath = targetFolder.key.endsWith ( "/" ) ? targetFolder.key : targetFolder.key + "/"
    const filesAtPath = await this.fileExplorerSvc.getFilesInFolder ( this.currentPath ( ) + targetFolderPath.replace ( this.userS3Path, "" ) )

    const exists = filesAtPath.some ( entry => {
      return entry.key ===  this.userS3Path + this.currentPath ( ) + targetFolderPath.replace ( this.userS3Path, "" ) + this.draggedFile?.name && !entry.isFolder
    } )

    if ( exists ) {
      const modalRef = this.modalSvc.open ( InputDialogComponent, {
        centered: true,
        backdrop: "static",
        size: "md"
      } )
      modalRef.componentInstance.title = "Overwrite Confirmation"
      modalRef.componentInstance.body = `File "<strong>${this.draggedFile.name}</strong>" already exists in the target folder. Do you want to overwrite it?`
      modalRef.componentInstance.confirmText = "Overwrite"
      modalRef.componentInstance.cancelText = "Cancel"
      let skipMove = false
      await modalRef.result.then ( async ( ) => {
        // Confirmed
      } ).catch ( ( ) => {
        skipMove = true
      } )
      if ( skipMove ) {
        this.draggedFile = null
        this.loading.set ( false )
        return
      }
    }

    try {
      await this.fileExplorerSvc.moveFile ( sourceKey, targetKey )
      this.listPath ( this.currentPath ( ) )
    } finally {
      this.draggedFile = null
      this.loading.set ( false )
    }
  }

  private async uploadFile ( file: File ) {
    this.loading.set ( true )
    const path = this.fileExplorerSvc.sanitizeS3Key ( file.webkitRelativePath || file.name )

    const fullKey = this.userS3Path + this.currentPath ( ) + path

    if ( file.size > this.quota ( ).remaining ) {
      this.toastrSvc.error ( "Upload would exceed your storage quota. Please delete some files and try again." )
      this.loading.set ( false )
      return
    }

    try {
      const response = await this.apiSvc.post ( `${this.baseRoute}/upload-url`, {
        key: fullKey,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream"
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as { uploadUrl: string }
      this.uploadToR2 ( data.uploadUrl, file, fullKey )
    } catch ( err: any ) {
      console.error ( "Upload URL error:", err )
      if ( err instanceof HttpErrorResponse ) {
        this.toastrSvc.error ( err.error, "Upload Error" )
      } else {
        this.toastrSvc.error ( "Failed to process upload" )
      }
      this.loading.set ( false )
    }
  }

  private async uploadToR2 ( url: string, file: File, key: string ) {
    try {
      const response = await fetch ( url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      } )
      if ( response.ok ) {
        await this.completeUpload ( key )
      } else {
        throw new Error ( "R2 upload failed: " + response.statusText )
      }
    } catch ( err: any ) {
      console.error ( "R2 upload failed:", err )
      this.toastrSvc.error ( "File upload failed" )
      this.loading.set ( false )
    }
  }

  private async completeUpload ( key: string ) {
    try {
      await this.apiSvc.post ( `${this.baseRoute}/upload-complete`, { key }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.listPath ( this.currentPath ( ) )
      this.fetchQuota ( )
      this.loading.set ( false )
    } catch ( err ) {
      console.error ( "Upload complete error:", err )
      this.toastrSvc.error ( "Upload succeeded, but failed to update quota. Please refresh." )
      this.loading.set ( false )
    }
  }
}