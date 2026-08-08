import { inject, Service, InjectionToken, Injector, signal, WritableSignal } from "@angular/core"
import { ApiService } from "./api.service"
import { Router } from "@angular/router"
import { FirebaseApp, getApps, initializeApp } from "firebase/app"
import {
  Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from "firebase/auth"
import { environment } from "@src/environments/environment"
import { HttpHeaders } from "@angular/common/http"

type ProfileResponse = { uid: string; role: string; profilePhoto: string | null }

@Service ( )
export class AuthService {
  private auth!: Auth
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly router: Router = inject ( Router )
  private readonly injector: Injector = inject ( Injector )

  private currentUser$: WritableSignal<User | null> = signal ( null )
  private profilePhoto$: WritableSignal<string | null> = signal ( null )
  private provider = new GoogleAuthProvider ( )
  private loading$: WritableSignal<boolean> = signal ( true )
  /** When true, onAuthStateChanged skips /verify — login() owns session creation. */
  private loginInProgress = false
  private sessionSync: Promise<void> = Promise.resolve ( )

  public get currentUser ( ) {
    return this.currentUser$.asReadonly ( )
  }

  public get profilePhoto ( ) {
    return this.profilePhoto$.asReadonly ( )
  }

  public get loading ( ) {
    return this.loading$.asReadonly ( )
  }

  /** Resolves once Firebase auth state (and any background session sync) has settled. */
  public whenReady ( ): Promise<void> {
    if ( !this.loading$ ( ) ) return Promise.resolve ( )
    return new Promise ( resolve => {
      const start = Date.now ( )
      const tick = ( ) => {
        if ( !this.loading$ ( ) || Date.now ( ) - start > 8000 ) {
          resolve ( )
          return
        }
        requestAnimationFrame ( tick )
      }
      tick ( )
    } )
  }

  public async login ( ) {
    this.loginInProgress = true
    this.loading$.set ( true )
    try {
      const userCredential = await signInWithPopup ( this.auth, this.provider )
      await this.waitForPageVisible ( )
      await this.establishSession ( userCredential.user )
      this.currentUser$.set ( userCredential.user )
      return userCredential.user
    } catch ( err ) {
      console.error ( "Login failed:", err )
      const code = ( err as { code?: string } | null )?.code
      if ( code !== "auth/popup-closed-by-user" && this.auth.currentUser ) {
        await this.logout ( )
      } else {
        this.currentUser$.set ( null )
        this.profilePhoto$.set ( null )
      }
      this.router.navigate ( [ "/" ] )
      throw this.toLoginError ( err )
    } finally {
      this.loginInProgress = false
      this.loading$.set ( false )
    }
  }

  public async logout ( ) {
    try {
      const user = this.currentUser$ ( )
      if ( user ) {
        const token = await user.getIdToken ( )
        await this.apiSvc.get ( "/api/admin/logout", { }, new HttpHeaders ( { "Authorization": `Bearer ${token}` } ) )
      }
    } catch {
      // Ignore errors during backend logout, always proceed with local sign out
    } finally {
      this.currentUser$.set ( null )
      this.profilePhoto$.set ( null )
      await this.waitForPageVisible ( )
      try {
        await signOut ( this.auth )
      } catch {
        // IndexedDB can be unavailable while the page is hidden after popup auth.
      }
    }
  }

  public loadAuth ( ) {
    const FIREBASE_APP = new InjectionToken<FirebaseApp> ( "FirebaseApp" )
    const FIREBASE_AUTH = new InjectionToken<Auth> ( "FirebaseMessaging" )

    const dynamicInjector = Injector.create ( {
      providers: [
        {
          provide: FIREBASE_APP,
          useFactory: ( ) => {
            return getApps ( ).length ? getApps ( ) [ 0 ]! : initializeApp ( environment.firebase )
          }
        },
        {
          provide: FIREBASE_AUTH,
          useFactory: ( app: FirebaseApp ) => {
            try {
              return initializeAuth ( app, {
                persistence: browserLocalPersistence,
                popupRedirectResolver: browserPopupRedirectResolver
              } )
            } catch {
              return getAuth ( app )
            }
          },
          deps: [ FIREBASE_APP ]
        }
      ],
      parent: this.injector
    } )

    this.auth = dynamicInjector.get ( FIREBASE_AUTH )

    onAuthStateChanged ( this.auth, async user => {
      this.currentUser$.set ( user )

      if ( user && !this.loginInProgress ) {
        this.sessionSync = this.syncServerSession ( user )
        try {
          await this.sessionSync
        } catch {
          // Page-restore sync failed — user can still sign in again via login()
        }
      } else if ( !user ) {
        this.profilePhoto$.set ( null )
        this.sessionSync = Promise.resolve ( )
      }

      if ( !this.loginInProgress ) {
        this.loading$.set ( false )
      }
    } )
  }

  private toLoginError ( err: unknown ): Error {
    const authErr = err as { code?: string; message?: string; status?: number; error?: { error?: string } } | null
    if ( authErr?.code === "auth/popup-closed-by-user" ) {
      return new Error ( "Sign-in was cancelled." )
    }
    if ( authErr?.code === "auth/popup-blocked" ) {
      return new Error ( "Sign-in popup was blocked by the browser." )
    }
    if ( authErr?.status === 401 || authErr?.status === 403 ) {
      return new Error ( authErr.error?.error || "Your account is not authorized for admin access." )
    }
    if ( authErr?.status === 404 ) {
      return new Error ( "Admin session could not be created. Try again." )
    }
    if ( authErr?.message && authErr.message !== "Login failed" ) {
      return new Error ( authErr.message )
    }
    return new Error ( "Login failed. Check the browser console for details." )
  }

  private waitForPageVisible ( ): Promise<void> {
    if ( typeof document === "undefined" || document.visibilityState === "visible" ) {
      return Promise.resolve ( )
    }

    return new Promise ( resolve => {
      const onVisible = ( ) => {
        if ( document.visibilityState === "visible" ) {
          document.removeEventListener ( "visibilitychange", onVisible )
          resolve ( )
        }
      }
      document.addEventListener ( "visibilitychange", onVisible )
    } )
  }

  private async authHeaders ( user: User, forceRefresh = false ): Promise<HttpHeaders> {
    const token = await user.getIdToken ( forceRefresh )
    return new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
  }

  private isSessionFailure ( err: unknown ): boolean {
    const status = ( err as { status?: number } | null )?.status
    return status === 401 || status === 404
  }

  /** Create/refresh server session, then load profile. */
  private async establishSession ( user: User ): Promise<void> {
    await this.apiSvc.get ( "/api/admin/newSession", { }, await this.authHeaders ( user ) )
    const res = await this.apiSvc.get (
      "/api/admin/verify",
      { },
      await this.authHeaders ( user, true )
    ) as ProfileResponse
    if ( res.profilePhoto ) {
      this.profilePhoto$.set ( res.profilePhoto )
    }
  }

  /**
   * For persisted Firebase sessions (page reload): verify, or create a session if expired.
   */
  private async syncServerSession ( user: User ): Promise<void> {
    try {
      const res = await this.apiSvc.get (
        "/api/admin/verify",
        { },
        await this.authHeaders ( user )
      ) as ProfileResponse
      if ( res.profilePhoto ) {
        this.profilePhoto$.set ( res.profilePhoto )
      }
    } catch ( err ) {
      if ( !this.isSessionFailure ( err ) ) {
        console.warn ( "Could not sync server session.", err )
        throw err
      }
      await this.establishSession ( user )
    }
  }
}
