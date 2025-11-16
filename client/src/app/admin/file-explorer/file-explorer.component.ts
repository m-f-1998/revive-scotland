import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AuthService } from "../../services/auth.service"
import { FileEntry, Quota } from "../../interfaces/fileExplorer.interface"
import { FileExplorerService } from "../../services/fileExplorer.service"
import { ApiService } from "../../services/api.service"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { FileExplorerModalComponent } from "./file-explorer-modal/file-explorer-modal.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { DatePipe } from "@angular/common"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { HttpHeaders } from "@angular/common/http"

@Component ( {
  selector: "app-admin-file-explorer",
  imports: [
    AdminNavbarComponent,
    DatePipe,
    FaIconComponent
  ],
  templateUrl: "./file-explorer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FileExplorerComponent {
  public readonly authSvc: AuthService = inject ( AuthService )
  public readonly fileExplorerSvc: FileExplorerService = inject ( FileExplorerService )
  public readonly iconSvc: IconService = inject ( IconService )

  public readonly userS3Path = `users/${this.authSvc.currentUser ( )?.uid || ""}/`

  public loading: WritableSignal<boolean> = signal ( false )
  public errorMessage: WritableSignal<string | null> = signal<string | null> ( null )
  public currentPath: WritableSignal<string> = signal ( "" ) // Relative path: '' or 'documents/images/'
  public fileList: WritableSignal<FileEntry[]> = signal<FileEntry[]> ( [] )
  public quota: WritableSignal<Quota> = signal<Quota> ( { used: 0, max: 1073741824, remaining: 0 } ) // Default 1GB max

  public breadcrumbs = computed ( ( ) => this.fileExplorerSvc.formatPathToBreadcrumbs ( this.currentPath ( ) ) )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )
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
    this.errorMessage.set ( null )
    this.currentPath.set ( relativePath )

    const path = relativePath || "/"

    try {
      const response = await this.apiSvc.get ( `${this.baseRoute}/list`, {
        path
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as FileEntry [ ]
      const formattedData = data.map ( item => ( {
        ...item,
        lastModified: item.lastModified ? new Date ( item.lastModified ) : undefined
      } ) )
      this.fileList.set ( formattedData )
      this.loading.set ( false )
    } catch ( err: any ) {
      console.error ( "List error:", err )
      this.errorMessage.set ( `Failed to load directory: ${err.error?.message || err.message}` )
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
      const response = await this.apiSvc.post ( `${this.baseRoute}/view-url`, { key }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as { viewUrl: string }
      window.open ( data.viewUrl, "_blank" )
      this.loading.set ( false )
    } catch ( err ) {
      console.error ( "View file error:", err )
      this.errorMessage.set ( `Failed to view file: ${err}` )
      this.loading.set ( false )
    }
  }

  public async shareFile ( key: string ) {
    this.loading.set ( true )
    try {
      const response = await this.apiSvc.post ( `${this.baseRoute}/share-url`, { key }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as { shareUrl: string }

      await navigator.clipboard.writeText ( data.shareUrl )

      console.log ( "Share URL copied to clipboard:", data.shareUrl )
      this.errorMessage.set ( "Share URL copied to clipboard! (Link expires in 24 hours)" )
      setTimeout ( ( ) => this.errorMessage.set ( null ), 5000 )
      this.loading.set ( false )
    } catch ( err: any ) {
      console.error ( "Share file error:", err )
      this.errorMessage.set ( `Failed to generate share URL: ${err.error?.message || err.message}` )
      this.loading.set ( false )
    }
  }

  // --- Upload Flow ---

  public onFileSelected ( event: Event ) {
    const input = event.target as HTMLInputElement
    const file = input.files?. [ 0 ]
    if ( file ) {
      this.uploadFile ( file )
    }
  }

  public async uploadFile ( file: File ) {
    this.loading.set ( true )
    const fileName = file.name.replace ( /[^a-zA-Z0-9.\-_]/g, "_" )
    const fullKey = this.userS3Path + this.currentPath ( ) + fileName

    try {
      const response = await this.apiSvc.post ( `${this.baseRoute}/upload-url`, {
        key: fullKey,
        contentType: file.type
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      const data = response as { uploadUrl: string }
      this.uploadToR2 ( data.uploadUrl, file, fullKey )
    } catch ( err: any ) {
      console.error ( "Upload URL error:", err )
      this.errorMessage.set ( `Failed to get upload credentials: ${err.error?.message || err.message}` )
      this.loading.set ( false )
    }
  }

  public async uploadToR2 ( url: string, file: File, key: string ) {
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
      this.errorMessage.set ( `File upload failed: ${err.message}` )
      this.loading.set ( false )
    }
  }

  public async completeUpload ( key: string ) {
    try {
      await this.apiSvc.post ( `${this.baseRoute}/upload-complete`, { key }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.listPath ( this.currentPath ( ) )
      this.fetchQuota ( )
      this.loading.set ( false )
    } catch ( err ) {
      console.error ( "Upload complete error:", err )
      this.errorMessage.set ( "Upload succeeded, but failed to update quota. Please refresh." )
      this.loading.set ( false )
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

        const fullKey = this.userS3Path + folderName

        try {
          await this.apiSvc.post ( `${this.baseRoute}/create-folder`, {
            key: fullKey
          }, new HttpHeaders ( {
            "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
          } ) )
          this.listPath ( this.currentPath ( ) )
        } catch ( err: any ) {
          console.error ( "Create folder error:", err )
          this.errorMessage.set ( `Failed to create folder: ${err.error?.message || err.message}` )
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
          this.errorMessage.set ( `Failed to delete resource: ${err.error?.message || err.message}` )
        }
      } else if ( type === "rename" ) {
        const newRelativeKey: string = result?.rename || ""
        let finalNewRelativeKey = newRelativeKey.trim ( )

        if ( data!.isFolder && !finalNewRelativeKey.endsWith ( "/" ) ) {
          finalNewRelativeKey += "/"
        }

        const newKey = this.userS3Path + finalNewRelativeKey

        try {
          await this.apiSvc.post ( `${this.baseRoute}/rename`, {
            oldKey: data!.key,
            newKey: newKey,
            isFolder: data!.isFolder
          }, new HttpHeaders ( {
            "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
          } ) )
          this.listPath ( this.currentPath ( ) )
        } catch ( err: any ) {
          console.error ( "Rename error:", err )
          this.errorMessage.set ( `Failed to rename/move: ${err.error?.message || err.message}` )
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
}