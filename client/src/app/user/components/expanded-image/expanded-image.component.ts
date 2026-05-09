
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, WritableSignal } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"
import { IconComponent } from "@revive/src/app/icon/icon.component"

@Component ( {
  selector: "app-expanded-image",
  imports: [
    IconComponent
  ],
  templateUrl: "./expanded-image.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown.arrowleft)": "prevImage()",
    "(document:keydown.arrowright)": "nextImage()"
  }
} )
export class ExpandedImageComponent {
  public imageURLs = input<string [ ]> ( [ ] )
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

  public close ( ) {
    this.dialogRef.close ( )
  }

  public nextImage ( ) {
    this.currentIndex.update ( i => i === this.imageURLs ( ).length - 1 ? 0 : i + 1 )
  }

  public prevImage ( ) {
    this.currentIndex.update ( i => i === 0 ? this.imageURLs ( ).length - 1 : i - 1 )
  }
}