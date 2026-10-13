import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal
} from "@angular/core"
import { gravatarUrlForEmail } from "../gravatar.util"

@Component ( {
  selector: "app-email-gravatar",
  templateUrl: "./email-gravatar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "inline-flex shrink-0"
  }
} )
export class EmailGravatarComponent {
  public email = input ( "" )
  /** Used for the letter fallback when Gravatar has no image. */
  public displayName = input ( "" )
  public size = input ( 40 )

  public initial = computed ( ( ) => {
    const fromName = this.displayName ( ).trim ( ).slice ( 0, 1 )
    if ( fromName ) return fromName.toUpperCase ( )
    const fromEmail = this.email ( ).trim ( ).slice ( 0, 1 )
    return fromEmail ? fromEmail.toUpperCase ( ) : "?"
  } )

  public photoSrc = computed ( ( ) => {
    const px = Math.min ( 512, Math.max ( 16, Math.round ( this.size ( ) * 2 ) ) )
    return gravatarUrlForEmail ( this.email ( ), px )
  } )

  public showPhoto = computed ( ( ) => this.photoOk ( ) && !this.photoFailed ( ) && !!this.photoSrc ( ) )

  private photoOk = signal ( false )
  private photoFailed = signal ( false )

  public constructor ( ) {
    effect ( ( ) => {
      this.email ( )
      this.photoOk.set ( false )
      this.photoFailed.set ( false )
    } )
  }

  protected onPhotoLoad ( ): void {
    this.photoOk.set ( true )
  }

  protected onPhotoError ( ): void {
    this.photoFailed.set ( true )
  }
}
