import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"
import { DBFile, FileNode } from "../interfaces/file.interface"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpErrorResponse } from "@angular/common/http"

@Injectable ( {
  providedIn: "root"
} )
export class FileService {
  private files: DBFile [ ] | undefined
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public async getFiles ( reinitialise: boolean = false ): Promise<DBFile[] | undefined> {
    if ( reinitialise || !this.files ) {
      await this.initialize ( )
    }
    return this.files
  }

  public async deleteFile ( fileId: string ): Promise<void> {
    try {
      await this.apiSvc.delete ( `/api/files/${fileId}` )
      this.files = this.files?.filter ( f => f.id !== fileId )
      this.toastrSvc.success ( "File deleted successfully", "Success" )
    } catch ( err ) {
      if ( err instanceof HttpErrorResponse ) {
        this.toastrSvc.error ( err.error?.message || "Failed to delete file", "Error" )
      } else {
        this.toastrSvc.error ( "Failed to delete file", "Error" )
      }
      throw err
    }
  }

  public async uploadFiles ( fileGroup: {
    relativePath: string
    files: File [ ]
  } [ ] ): Promise<void> {
    for ( const group of fileGroup ) {
      const files = group.files
      if ( !files.length ) return

      const formData = new FormData ( )
      files.forEach ( file => formData.append ( "files", file ) )
      formData.append ( "relativePath", group.relativePath )
      try {
        await this.apiSvc.post ( "/api/files/upload", formData )
      } catch ( err ) {
        if ( err instanceof HttpErrorResponse ) {
          this.toastrSvc.error ( err.error?.message || "File upload failed", "Error" )
        } else {
          this.toastrSvc.error ( "File upload failed", "Error" )
        }
        throw err
      }
    }
  }

  public translateMimeType ( mimeType: string ): string {
    switch ( mimeType ) {
      case "application/pdf":
        return "PDF Document"
      case "image/png":
        return "PNG Image"
      case "image/jpg":
      case "image/jpeg":
        return "JPG Image"
      default:
        return mimeType
    }
  }

  public translateByteSize ( bytes: number ): string {
    // if less than 1KB, show in bytes
    if ( bytes < 1024 ) {
      return `${ bytes } B`
    }
    // if less than 1MB, show in KB
    if ( bytes < 1024 * 1024 ) {
      return `${ ( bytes / 1024 ).toFixed ( 2 ) } KB`
    }
    // if less than 1GB, show in MB
    if ( bytes < 1024 * 1024 * 1024 ) {
      return `${ ( bytes / ( 1024 * 1024 ) ).toFixed ( 2 ) } MB`
    }
    // otherwise, show in GB
    return `${ ( bytes / ( 1024 * 1024 * 1024 ) ).toFixed ( 2 ) } GB`
  }

  public async createShare (
    fileId: string,
    options?: { expiresAt?: string; maxDownloads?: number }
  ): Promise<any> {
    try {
      return await this.apiSvc.post ( `/api/files/${fileId}/shares`, options || {} )
    } catch ( err ) {
      console.error ( "Failed to create share link", err )
      throw err
    }
  }

  public async getShares ( fileId: string ): Promise<any[]> {
    try {
      return await this.apiSvc.get ( `/api/files/${fileId}/shares` ) as any[]
    } catch ( err ) {
      console.error ( "Failed to get share links", err )
      return []
    }
  }

  public async revokeShare ( shareId: string ): Promise<boolean> {
    try {
      await this.apiSvc.delete ( `/api/files/shares/${shareId}` )
      return true
    } catch ( err ) {
      console.error ( "Failed to revoke share link", err )
      return false
    }
  }

  public buildFileTree ( files: DBFile [ ] ): FileNode [ ] {
    const root: FileNode[] = []

    for ( const file of files ) {
      const parts = file.path.split ( "/" ).filter ( Boolean )
      let currentLevel = root

      parts.forEach ( ( part, i ) => {
        let existingNode = currentLevel.find ( n => n.name === part )

        if ( !existingNode ) {
          existingNode = {
            id: i === parts.length - 1 ? file.id : undefined,
            name: part,
            path: "/" + parts.slice ( 0, i + 1 ).join ( "/" ),
            isFolder: i < parts.length - 1,
            children: i < parts.length - 1 ? [ ] : undefined,
            file: i === parts.length - 1 ? file : undefined,
          }
          currentLevel.push ( existingNode )
        }

        // Move down one level if folder
        if ( existingNode.children ) {
          currentLevel = existingNode.children
        }
      } )
    }

    return root
  }

  private async initialize ( ) {
    try {
      const files = await this.apiSvc.get ( "/api/files" ) as DBFile [ ]
      this.files = files.sort ( ( a, b ) =>
        new Date ( a.file_created_at ?? 0 ).getTime ( ) - new Date ( b.file_created_at ?? 0 ).getTime ( )
      )
    } catch ( error: any ) {
      console.error ( error )
      this.files = [ ]
    }
  }
}