import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http"
import { inject, Injectable, isDevMode } from "@angular/core"
import { parse } from "date-fns"

@Injectable ( {
  providedIn: "root"
} )
export class ApiService {
  private readonly httpClient: HttpClient = inject ( HttpClient )

  public get (
    path: string,
    body: HttpParams | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>> = { },
    headers: HttpHeaders = new HttpHeaders ( )
  ) {
    const address = ( isDevMode ( ) ? "http://localhost:3000" : "" ) + path
    let httpHeaders = headers

    if ( !( body instanceof FormData ) ) {
      httpHeaders = httpHeaders.append ( "Content-Type", "application/json" )
    }

    return new Promise ( ( resolve, reject ) => {
      this.httpClient.get ( address, {
        params: body,
        headers: httpHeaders,
        responseType: "json"
      } as object ).subscribe ( {
        next: response => {
          resolve ( this.parseObj ( response ) )
        },
        error: error => {
          reject ( error )
        }
      } )
    } )
  }

  public post (
    path: string,
    body: unknown = { },
    headers: HttpHeaders = new HttpHeaders ( )
  ) {
    const address = ( isDevMode ( ) ? "http://localhost:3000" : "" ) + path
    let httpHeaders = headers

    if ( !( body instanceof FormData ) ) {
      httpHeaders = httpHeaders.append ( "Content-Type", "application/json" )
    }

    return new Promise ( ( resolve, reject ) => {
      this.httpClient.post ( address, body, {
        headers: httpHeaders,
        responseType: "json"
      } as object ).subscribe ( {
        next: response => {
          resolve ( this.parseObj ( response ) )
        },
        error: error => {
          reject ( error )
        }
      } )
    } )
  }

  public delete (
    path: string,
    body: HttpParams | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>> = { },
    headers: HttpHeaders = new HttpHeaders ( )
  ) {
    const address = ( isDevMode ( ) ? "http://localhost:3000" : "" ) + path
    let httpHeaders = headers

    if ( !( body instanceof FormData ) ) {
      httpHeaders = httpHeaders.append ( "Content-Type", "application/json" )
    }

    return new Promise ( ( resolve, reject ) => {
      this.httpClient.delete ( address, {
        headers: httpHeaders,
        body: body,
        responseType: "json"
      } as object ).subscribe ( {
        next: response => {
          resolve ( this.parseObj ( response ) )
        },
        error: error => {
          reject ( error )
        }
      } )
    } )
  }
  private parseObj<T>( obj: T ): T {
    if ( obj && typeof obj === "object" ) {
      const res = obj as Record<string, unknown>

      for ( const key of Object.keys ( res ) ) {
        const value = res [ key ]

        if ( value ) {
          if ( Array.isArray ( value ) ) {
            res [ key ] = value.map ( x => this.parseObj ( x ) )
          } else if ( typeof value === "object" ) {
            res [ key ] = this.parseObj ( value )
          } else if ( typeof value === "string" && this.isNumber ( value ) ) {
            res [ key ] = Number ( value )
          } else if ( typeof value === "string" && this.isBool ( value ) ) {
            res [ key ] = Boolean ( value )
          }

          if ( typeof res [ key ]  === "string" ) {
            res [ key ] = this.checkDate ( res [ key ] )
          }
        }
      }
    }

    return obj
  }

  private isBool = ( value: string ): boolean => {
    return String ( value ).toUpperCase ( ) === "TRUE" || String ( value ).toUpperCase ( ) === "FALSE"
  }

  private isNumber = ( value: string ): boolean => {
    if ( value != null ) {
      return ( String ( value ).length == 1 || !String ( value ).startsWith ( "0" ) ) && !isNaN ( Number ( value ) ) && String ( value ) != ""
    }
    return false
  }

  private checkDate = ( value: string ): Date | string  => {
    const dangerous_format = [
      "yyyy-MM-dd",
      "dd/MM/yyyy"
    ]

    for ( const format of [
      "dd/MM/yyyy HH:mm",
      "E dd/MM/yyyy",
      "E dd/MM/yyyy HH:mm",
      "yyyy-MM-dd",
      "dd/MM/yyyy",
      "yyyy-MM-dd HH:mm:ss",
      "yyyy-MM-dd HH:mm",
      "yyyy-MM-dd HH:mm:ss.SSSSSS",
      "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
    ] ) {
      try {
        const res = parse ( value, format, new Date ( ) )

        const is_dangerous = dangerous_format.includes ( format )
        const allow_dangerous = is_dangerous && format.length === value.length

        if ( res.toString ( ) !== "Invalid Date" && ( !is_dangerous || allow_dangerous ) ) {
          return res
        }
      } catch {
        continue
      }
    }
    return value
  }
}