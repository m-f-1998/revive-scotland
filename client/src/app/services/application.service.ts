import { Injectable, signal, WritableSignal } from "@angular/core"

@Injectable ( {
  providedIn: "root"
} )
export class ApplicationService {
  public isLoggedIn: WritableSignal<boolean> = signal ( false )
  public token: WritableSignal<string> = signal ( "" )

  public setLogin ( token: string ) {
    this.isLoggedIn.set ( true )
    this.token.set ( token )
  }

  public setLogout ( ) {
    this.isLoggedIn.set ( false )
    this.token.set ( "" )
  }
}