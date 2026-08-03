import { inject, Service, WritableSignal } from "@angular/core"
import { FileEntry, Quota } from "../interfaces/fileExplorer.interface"
import { HttpHeaders, HttpErrorResponse } from "@angular/common/http"
import { ApiService } from "./api.service"
import { AuthService } from "./auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Service ( )
export class FileExplorerService {
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  private readonly baseRoute = "/api/admin/file-explorer"

  public formatBytes ( bytes: number, decimals = 2 ): string {
    if ( bytes === 0 ) return "0 Bytes"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = [ "Bytes", "KB", "MB", "GB", "TB" ]
    const i = Math.floor ( Math.log ( bytes ) / Math.log ( k ) )
    return parseFloat ( ( bytes / Math.pow ( k, i ) ).toFixed ( dm ) ) + " " + sizes [ i ]
  }

  public formatPathToBreadcrumbs ( path: string ): { label: string; path: string } [ ] {
    const parts = path.split ( "/" ).filter ( p => p.length > 0 )
    const breadcrumbs: { label: string; path: string } [ ] = [ { label: "Home", path: "" } ]

    let currentPath = ""
    for ( const part of parts ) {
      currentPath += part + "/"
      breadcrumbs.push ( { label: part, path: currentPath } )
    }

    return breadcrumbs
  }

  public sanitizeS3Key ( rawPath: string ): string {
    let path = rawPath.replace ( /\\/g, "/" )
    path = path.replace ( /\.\.+/g, "_" )
    path = path.replace ( /\/+/g, "/" )

    const parts = path.split ( "/" )
    const safeParts = parts.map ( ( part, index ) => {
      if ( index === parts.length - 1 ) {
        const lastDot = part.lastIndexOf ( "." )
        if ( lastDot > 0 ) {
          const name = part.slice ( 0, lastDot ).replace ( /[^a-zA-Z0-9 \-_( ){}\[\]!@#%&]/g, "_" )
          const ext = part.slice ( lastDot + 1 ).replace ( /[^a-zA-Z0-9]/g, "_" )
          return name + "." + ext
        }
      }
      return part.replace ( /[^a-zA-Z0-9 \-_( ){}\[\]!@#%&]/g, "_" )
    } )

    return safeParts.join ( "/" )
  }

  public async getFilesInFolder ( path: string ): Promise<FileEntry [ ]> {
    const response = await this.apiSvc.get ( `${this.baseRoute}/list`, {
      path: path.endsWith ( "/" ) ? path.slice ( 0, -1 ) : path
    }, await this.getAuthHeaders ( ) )
    return response as FileEntry [ ]
  }

  public async getQuota ( ): Promise<Quota> {
    const response = await this.apiSvc.get ( `${this.baseRoute}/quota`, { }, await this.getAuthHeaders ( ) )
    return response as Quota
  }

  public async createFolder ( key: string ): Promise<void> {
    await this.apiSvc.post ( `${this.baseRoute}/create-folder`, { key }, await this.getAuthHeaders ( ) )
  }

  public async deleteFile ( key: string, isFolder: boolean ): Promise<void> {
    await this.apiSvc.post ( `${this.baseRoute}/delete`, { key, isFolder }, await this.getAuthHeaders ( ) )
  }

  public async renameFile ( oldKey: string, newKey: string, isFolder: boolean ): Promise<void> {
    await this.apiSvc.post ( `${this.baseRoute}/rename`, { oldKey, newKey, isFolder }, await this.getAuthHeaders ( ) )
  }

  public async moveFile ( sourceKey: string, targetFolderKey: string ): Promise<void> {
    const newKey = targetFolderKey + sourceKey.slice ( sourceKey.lastIndexOf ( "/" ) + 1 )
    await this.renameFile ( sourceKey, newKey, false )
  }

  public async getViewUrl ( key: string ): Promise<string> {
    const response = await this.apiSvc.get ( `${this.baseRoute}/view-url`, { key }, await this.getAuthHeaders ( ) )
    return ( response as { viewUrl: string } ).viewUrl
  }

  public async getShareUrl ( key: string, expiry: number ): Promise<string> {
    const response = await this.apiSvc.get ( `${this.baseRoute}/share-url`, { key, expiresIn: expiry.toString ( ) }, await this.getAuthHeaders ( ) )
    return ( response as { shareUrl: string } ).shareUrl
  }

  // Orchestrates the entire file upload process (get signed URL -> PUT to S3 -> confirm completion)
  public async uploadFile ( file: File, fullKey: string ): Promise<void> {
    try {
      // 1. Get the pre-signed URL from our backend
      const response = await this.apiSvc.post ( `${this.baseRoute}/upload-url`, {
        key: fullKey,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream"
      }, await this.getAuthHeaders ( ) )

      const { uploadUrl } = response as { uploadUrl: string }

      // 2. Upload the file directly to R2 using the pre-signed URL
      const uploadResponse = await fetch ( uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      } )

      if ( !uploadResponse.ok ) {
        throw new Error ( `R2 upload failed: ${uploadResponse.statusText}` )
      }

      // 3. Confirm the upload and update quota
      await this.apiSvc.post ( `${this.baseRoute}/upload-complete`, { 
        key: fullKey, 
        fileSize: file.size 
      }, await this.getAuthHeaders ( ) )

    } catch ( err ) {
      if ( err instanceof HttpErrorResponse ) {
        this.toastrSvc.error ( err.error, "Upload Error" )
      } else {
        this.toastrSvc.error ( "Failed to process upload" )
      }
      throw err
    }
  }

  public async uploadMultipleFiles ( files: File[], currentPath: string, userS3Path: string, loadingSignal: WritableSignal<boolean> ): Promise<void> {
    if ( !files || files.length === 0 ) return

    loadingSignal.set ( true )
    const tasks = [ ]

    for ( let i = 0; i < files.length; i++ ) {
      const f = files [ i ]
      const path = this.sanitizeS3Key ( f.webkitRelativePath || f.name )
      const fullKey = userS3Path + currentPath + path

      // Fire uploads concurrently
      tasks.push ( this.uploadFile ( f, fullKey ) )
    }

    try {
      await Promise.all ( tasks )
      this.toastrSvc.success ( "All files uploaded successfully!" )
    } catch ( err ) {
      console.error ( "One or more files failed to upload:", err )
    } finally {
      loadingSignal.set ( false )
    }
  }

  private async getAuthHeaders ( ): Promise<HttpHeaders> {
    const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
    return new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
  }
}
