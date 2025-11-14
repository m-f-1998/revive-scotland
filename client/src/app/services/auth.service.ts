import { inject, Injectable, InjectionToken, Injector, signal, WritableSignal } from "@angular/core"
import { ApiService } from "./api.service"
import { Router } from "@angular/router"
import { FirebaseApp, initializeApp } from "firebase/app"
import { Auth, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth"
import { environment } from "@revive/src/environments/environments"

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

  public get currentUser ( ) {
    return this.currentUser$.asReadonly ( )
  }

  public get loading ( ) {
    return this.loading$.asReadonly ( )
  }

  public async login ( ) {
    try {
      const userCredential = await signInWithPopup ( this.auth, this.provider )
      await this.apiSvc.get ( "/api/admin/role", { uid: userCredential.user.uid } )
      await this.apiSvc.get ( "/api/admin/isAdmin", { uid: userCredential.user.uid } )
      return userCredential.user
    } catch {
      await this.logout ( )
      this.router.navigate ( [ "/" ] )
      throw new Error ( "Login failed" )
    }
  }

  public logout ( ) {
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

    onAuthStateChanged ( this.auth, user => {
      this.currentUser$.set ( user ) // Will be null if not logged in
      this.loading$.set ( false )
    } )
  }
}