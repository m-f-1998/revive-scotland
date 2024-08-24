import { HttpClient, HttpHeaders } from "@angular/common/http"
import { Injectable, Injector } from "@angular/core"
import { AdminService } from "./AdminService.service"
import { parse } from "date-fns"

@Injectable ( {
  providedIn: "root"
} )
export class HttpService {
  private readonly ADDRESS = "http://localhost:8000"

  public constructor (
    private httpClient: HttpClient,
    private injector: Injector
  ) { }

  public request ( path: string, body: any = { }, method: "GET" | "POST" | "DELETE" = "GET" ) {
    const adminSvc = this.injector.get ( AdminService )

    const address = this.ADDRESS + path
    let headers = new HttpHeaders ( )

    if ( adminSvc.token !== "" && ( adminSvc.loggedIn || path === "/login.php" ) ) {
      headers = headers.append ( "X-Auth", adminSvc.token )
    }

    if ( !( body instanceof FormData ) ) {
      headers = headers.append ( "Content-Type", "application/json" )
    }

    if ( path === "/asset.php" ) {
      headers = headers.append ( "Response-Type", "blob" )
    }

    switch ( method ) {
      case "GET":
        return this.get ( address, headers, body ).catch ( e => {
          if ( e.status === 401 && adminSvc.loggedIn ) adminSvc.logout ( true )
          return Promise.reject ( e )
        } )
      case "POST":
        return this.post ( address, headers, body ).catch ( e => {
          if ( e.status === 401 && adminSvc.loggedIn ) adminSvc.logout ( true )
          return Promise.reject ( e )
        } )
      case "DELETE":
        return this.delete ( address, headers, body ).catch ( e => {
          if ( e.status === 401 && adminSvc.loggedIn ) adminSvc.logout ( true )
          return Promise.reject ( e )
        } )
    }
  }

  private get ( address: string, headers: HttpHeaders, body: any = { },  ) {
    return new Promise ( ( resolve, reject ) => {
      this.httpClient.get ( address, {
        params: body,
        headers,
        responseType: address.endsWith ( "/asset.php" ) ? "blob" : "json"
      } as Object ).subscribe ( {
        next: ( response ) => {
          resolve ( this.parseData ( response ) )
        },
        error: ( error ) => {
          reject ( error )
        }
      } )
    } )
  }

  private post ( address: string, headers: HttpHeaders, body: any = { },  ) {
    return new Promise ( ( resolve, reject ) => {
      this.httpClient.post ( address, body, {
        headers
      } ).subscribe ( {
        next: ( response ) => {
          resolve ( this.parseData ( response ) )
        },
        error: ( error ) => {
          reject ( error )
        }
      } )
    } )
  }

  private delete ( address: string, headers: HttpHeaders, body: any = { },  ) {
    return new Promise ( ( resolve, reject ) => {
      this.httpClient.delete ( address, {
        body,
        headers
      } ).subscribe ( {
        next: ( response ) => {
          resolve ( this.parseData ( response ) )
        },
        error: ( error ) => {
          reject ( error )
        }
      } )
    } )
  }

  public parseData ( res: any ) {
    if ( Array.isArray ( res ) )
      res.forEach ( x => {
        this.parseData ( x )
      } )
    if ( res instanceof Object )
      for ( let key of Object.keys ( res ) ) {
        if ( Array.isArray ( res [ key ] ) || typeof res [ key ] === "object" ) {
          this.parseData ( res [ key ] )
        } else {
          if ( res [ key ] && typeof res [ key ] === "string" ) {
            for ( let format of [
              "yyyy-MM-dd HH:mm:ss",
              "yyyy-MM-dd HH:mm",
              "yyyy-MM-dd"
            ] ) {
              const isDate = parse ( res [ key ], format, new Date ( ) )
              if ( isDate instanceof Date && !isNaN ( isDate.getDate ( ) ) ) {
                res [ key ] = isDate
                break
              }
            }
            const isNumber = isNaN ( res [ key ] )
            if ( !isNumber ) {
              res [ key ] = Number ( res [ key ] )
            }
          }
        }
      }
    return res
  }
}