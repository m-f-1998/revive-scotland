import { Injectable } from "@angular/core"
import { HttpService } from "./HttpService.service"
import { from, Observable, of } from "rxjs"
import { ToastrService } from "ngx-toastr"
import { Router } from "@angular/router"

@Injectable ( {
  providedIn: "root"
} )
export class AdminService {
  public loggedIn = false
  public token = ""
  public user: {
    username: string,
    permissions: string,
    email: string,
  } | null = null

  constructor (
    private httpClient: HttpService,
    private toastrSvc: ToastrService,
    private router: Router
  ) { }

  public resumeSession ( ): Observable<boolean> {
    const token = localStorage.getItem ( "token" ) as string
    if ( token ) {
      this.token = token
      return from ( this.httpClient.request ( "/login.php", {}, "POST" ).then ( ( res: any ) => {
        this.token = token
        this.loggedIn = true
        this.user = res.user
        return true
      } ).catch ( e => {
        if ( e.status !== 401 ) {
          console.error ( e )
        }
        localStorage.removeItem ( "token" )
        return true
      } ) )
    } else {
      return of ( false )
    }
  }

  public logout ( sessionExpiry = false ) {
    if ( sessionExpiry )
      this.toastrSvc.info ( "Your Session has Expired. Please Re-Login" )
    this.loggedIn = false
    this.token = ""
    this.user = null
    localStorage.removeItem ( "token" )
    this.router.navigate ( [ "/admin/login" ] )
  }
}