
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, WritableSignal } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"
import { IconComponent } from "@revive/src/app/icon/icon.component"

export type LightboxItem = { url: string; type: "image" | "video" }

@Component ( {
  selector: "app-expanded-image",
  imports: [
    IconComponent
  ],
  templateUrl: "./expanded-image.component.html",
  styleUrl: "./expanded-image.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown.arrowleft)": "prevItem()",
    "(document:keydown.arrowright)": "nextItem()"
  }
} )
export class ExpandedImageComponent {
  public items = input<LightboxItem [ ]> ( [ ] )
  public index = input<number> ( 0 )

  public currentIndex: WritableSignal<number> = signal ( 0 )

  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public constructor ( ) {
    effect ( ( ) => { this.currentIndex.set ( this.index ( ) ) } )
  }

  public imgSrc ( url: string, w: number ): string {
    if ( url.startsWith ( "/" ) || url.startsWith ( "http" ) ) return url
    return `/api/img/${url}?w=${w}&f=webp`
  }

  public imgSrcset ( url: string ): string | null {
    if ( url.startsWith ( "/" ) || url.startsWith ( "http" ) ) return null
    return `/api/img/${url}?w=320&f=webp 320w, /api/img/${url}?w=640&f=webp 640w, /api/img/${url}?w=1024&f=webp 1024w`
  }

  public videoSrc ( url: string ): string {
    if ( url.startsWith ( "/" ) || url.startsWith ( "http" ) ) return url
    return `/api/img/${url}`
  }

  public close ( ) {
    this.dialogRef.close ( )
  }

  public nextItem ( ) {
    this.currentIndex.update ( i => i === this.items ( ).length - 1 ? 0 : i + 1 )
  }

  public prevItem ( ) {
    this.currentIndex.update ( i => i === 0 ? this.items ( ).length - 1 : i - 1 )
  }
}