import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"
import { File } from "../interfaces/file.interface"

@Injectable ( {
  providedIn: "root"
} )
export class FileService {
  private files: File [ ] | undefined
  private readonly apiSvc: ApiService = inject ( ApiService )

  public async getFiles ( ): Promise<File[] | undefined> {
    if ( !this.files ) {
      await this.initialize ( )
    }
    return this.files
  }

  public async deleteFile ( _file: File ): Promise<boolean> {
    return Promise.resolve ( false )
  }

  public async uploadFile ( _file: File ): Promise<File | undefined> {
    return Promise.resolve ( undefined )
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
      case "application/msword":
        return "Word Document"
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return "Word Document (DOCX)"
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

  private async initialize ( ) {
    try {
      const files = await this.apiSvc.get ( "/api/files" ) as File [ ]
      this.files = files.sort ( ( a, b ) =>
        new Date ( a.createdAt ?? 0 ).getTime ( ) - new Date ( b.createdAt ?? 0 ).getTime ( )
      )
    } catch ( error: any ) {
      console.error ( error )
      this.files = [ ]
    }
  }
}