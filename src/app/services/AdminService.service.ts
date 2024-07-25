import { Injectable } from "@angular/core"
import { Router } from "@angular/router"
import { ToastrService } from "ngx-toastr"
import { HttpService } from "./HttpService.service"
import { Location } from "@angular/common"

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
    private router: Router,
    private toastrSvc: ToastrService,
    private location: Location
  ) { }

  public resumeSession ( ) {
    const token = localStorage.getItem ( "token" ) as string
    if ( token ) {
      this.token = token
      this.httpClient.request ( "/login.php", {} ).then ( ( res: any ) => {
        this.token = token
        this.loggedIn = true
        this.user = res.user
        if ( this.location.path ( ) === "/admin/login" ) {
          this.router.navigate ( [ "/admin/dashboard" ] )
        }
      } ).catch ( e => {
        if ( e.status !== 401 ) {
          console.error ( e )
        }
        localStorage.removeItem ( "token" )
      } )
    }
  }

  public logout ( ) {
    this.loggedIn = false
    this.token = ""
    this.user = null
    localStorage.removeItem ( "token" )
  }
}