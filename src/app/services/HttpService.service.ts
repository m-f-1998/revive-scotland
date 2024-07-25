import { HttpClient, HttpHeaders } from "@angular/common/http"
import { Injectable, Injector } from "@angular/core"
import { AdminService } from "./AdminService.service"

@Injectable ( {
  providedIn: "root"
} )
export class HttpService {
  private readonly ADDRESS = "http://localhost:8000"

  public constructor (
    private httpClient: HttpClient,
    private injector: Injector
  ) { }

  public request ( path: string, body: any = { } ) {
    const adminSvc = this.injector.get ( AdminService )

    const headers = new HttpHeaders ( {
      "Content-Type": "application/json",
      "X-Auth": adminSvc.token
    } )

    return new Promise ( ( resolve, reject ) => {
      this.httpClient.post ( this.ADDRESS + path, body, { headers } ).subscribe ( {
        next: ( response: any ) => {
          resolve ( response )
        },
        error: ( error ) => {
          if ( error.status === 401 ) {
            adminSvc.loggedIn = false
            adminSvc.token = ""
            adminSvc.user = null
          }
          reject ( error )
        }
      } )
    } )
  }
}