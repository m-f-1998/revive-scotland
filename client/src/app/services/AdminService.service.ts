import { Injectable, signal, WritableSignal } from "@angular/core"
import { ApiService } from "./api.service"
import { from, Observable, of } from "rxjs"
import { ToastrService } from "ngx-toastr"
import { Router } from "@angular/router"

@Injectable ( {
  providedIn: "root"
} )
export class AdminService {
  public loggedIn: WritableSignal<boolean> = signal ( false )
  public token: WritableSignal<string> = signal ( "" )
  public user: WritableSignal<{
    username: string
    permissions: string
    email: string
  } | null> = signal ( null )

  public constructor (
    private apiSvc: ApiService,
    private toastrSvc: ToastrService,
    private router: Router
  ) { }

  public resumeSession ( ): Observable<boolean> {
    const token = localStorage.getItem ( "token" ) as string
    if ( token ) {
      this.token.set ( token )
      return from ( this.apiSvc.request ( "/login.php", {}, "POST" ).then ( ( res: any ) => {
        this.token.set ( token )
        this.loggedIn.set ( true )
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
    this.loggedIn.set ( false )
    this.token.set ( "" )
    this.user.set ( null )
    localStorage.removeItem ( "token" )
    this.router.navigate ( [ "/admin/login" ] )
  }
}