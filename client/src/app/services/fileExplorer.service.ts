import { Injectable } from "@angular/core"
// import { ApiService } from "./api.service"
// import { AuthService } from "./auth.service"
// import { HttpHeaders } from "@angular/common/http"

@Injectable ( {
  providedIn: "root"
} )
export class FileExplorerService {
  // private readonly apiSvc: ApiService = inject ( ApiService )

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
    const breadcrumbs: { label: string; path: string } [ ] = [ { label: "home", path: "" } ]

    let currentPath = ""
    for ( const part of parts ) {
      currentPath += part + "/"
      breadcrumbs.push ( { label: part, path: currentPath } )
    }
    return breadcrumbs
  }
}