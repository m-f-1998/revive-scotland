import { inject, Injectable } from "@angular/core"
import { FileEntry } from "../interfaces/fileExplorer.interface"
import { HttpHeaders } from "@angular/common/http"
import { ApiService } from "./api.service"
import { AuthService } from "./auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Injectable ( {
  providedIn: "root"
} )
export class FileExplorerService {
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public formatBytes ( bytes: number, decimals = 2 ): string {
    if ( bytes === 0 ) return "0 Bytes"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = [ "Bytes", "KB", "MB", "GB", "TB" ]
    const i = Math.floor ( Math.log ( bytes ) / Math.log ( k ) )
    return parseFloat ( ( bytes / Math.pow ( k, i ) ).toFixed ( dm ) ) + " " + sizes [ i ]
  }

  public formatPathToBreadcrumbs ( path: string ): { label: string; path: string } [ ] {
    // path is relative to the user root (e.g., 'documents/project1/')
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
    // Normalize Windows backslashes
    let path = rawPath.replace ( /\\/g, "/" )

    // Remove any traversal attempts
    path = path.replace ( /\.\.+/g, "_" ) // replace .. sequences
    path = path.replace ( /\/+/g, "/" )   // collapse multiple slashes

    // Split into directories and filename
    const parts = path.split ( "/" )

    const safeParts = parts.map ( ( part, index ) => {
    // For the last part (filename), allow dots for extension
      if ( index === parts.length - 1 ) {
        const lastDot = part.lastIndexOf ( "." )
        if ( lastDot > 0 ) {
          const name = part.slice ( 0, lastDot ).replace ( /[^a-zA-Z0-9 \-_(){}\[\]!@#%&]/g, "_" )
          const ext = part.slice ( lastDot + 1 ).replace ( /[^a-zA-Z0-9]/g, "_" )
          return name + "." + ext
        }
      }
      // For folders, allow only safe characters (no dots)
      return part.replace ( /[^a-zA-Z0-9 \-_(){}\[\]!@#%&]/g, "_" )
    } )

    return safeParts.join ( "/" )
  }

  public async getFilesInFolder ( path: string ): Promise<FileEntry [ ]> {
    const response = await this.apiSvc.get ( `/api/admin/file-explorer/list`, {
      path: path.endsWith ( "/" ) ? path.slice ( 0, -1 ) : path
    }, new HttpHeaders ( {
      "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
    } ) )
    const data = response as FileEntry [ ]
    return data
  }

  public async moveFile ( sourceKey: string, targetFolderKey: string ) {
    try {
      await this.apiSvc.post ( "/api/admin/file-explorer/rename", {
        oldKey: sourceKey,
        newKey: targetFolderKey + sourceKey.slice ( sourceKey.lastIndexOf ( "/" ) + 1 ),
        isFolder: false
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
    } catch ( err ) {
      console.error ( "Move error:", err )
      this.toastrSvc.error ( "Failed to move file" )
    }
  }

}