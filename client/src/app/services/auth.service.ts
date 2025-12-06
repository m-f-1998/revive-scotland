import { inject, Injectable, InjectionToken, Injector, signal, WritableSignal } from "@angular/core"
import { ApiService } from "./api.service"
import { Router } from "@angular/router"
import { FirebaseApp, initializeApp } from "firebase/app"
import { Auth, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth"
import { environment } from "@revive/src/environments/environments"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Injectable ( {
  providedIn: "root"
} )
export class AuthService {
  private auth: Auth
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly router: Router = inject ( Router )
  private readonly injector: Injector = inject ( Injector )

  private currentUser$: WritableSignal<User | null> = signal ( null )
  private provider = new GoogleAuthProvider ( )
  private loading$: WritableSignal<boolean> = signal ( true )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public get currentUser ( ) {
    return this.currentUser$.asReadonly ( )
  }

  public get loading ( ) {
    return this.loading$.asReadonly ( )
  }

  public async login ( ) {
    try {
      const userCredential = await signInWithPopup ( this.auth, this.provider )
      await this.apiSvc.get ( "/api/admin/newSession", { uid: userCredential.user.uid } )
      await this.apiSvc.get ( "/api/admin/isAdmin", { uid: userCredential.user.uid } )
      return userCredential.user
    } catch {
      await this.logout ( )
      this.router.navigate ( [ "/" ] )
      throw new Error ( "Login failed" )
    }
  }

  public logout ( ) {
    this.apiSvc.get ( "/api/admin/logout", { uid: this.currentUser$ ( )?.uid || "" } ).catch ( ( ) => {
      // Ignore errors during logout
    } )
    this.currentUser$.set ( null )
    return signOut ( this.auth )
  }

  public loadAuth ( ) {
    const FIREBASE_APP = new InjectionToken<FirebaseApp> ( "FirebaseApp" )
    const FIREBASE_AUTH = new InjectionToken<Auth> ( "FirebaseMessaging" )

    const dynamicInjector = Injector.create ( {
      providers: [
        {
          provide: FIREBASE_APP,
          useFactory: ( ) => {
            return initializeApp ( environment.firebase )
          }
        },
        {
          provide: FIREBASE_AUTH,
          useFactory: ( app: FirebaseApp ) => getAuth ( app ),
          deps: [ FIREBASE_APP ] // ensures messaging is created from the app instance
        }
      ],
      parent: this.injector
    } )

    this.auth = dynamicInjector.get ( FIREBASE_AUTH )

    onAuthStateChanged ( this.auth, async user => {
      // Check if the user session is still valid on the server
      try {
        if ( user ) {
          await this.apiSvc.get ( "/api/admin/verify", { uid: user?.uid || "" } )
          this.currentUser$.set ( user ) // Will be null if not logged in
          this.loading$.set ( false )
        } else {
          this.currentUser$.set ( null )
          this.loading$.set ( false )
        }
      } catch {
        this.toastrSvc.error ( "Session has expired. Please log in again." )
        this.logout ( )
        this.router.navigate ( [ "/" ] )
      }
    } )
  }
}