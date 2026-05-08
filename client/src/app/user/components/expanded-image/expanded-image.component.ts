
import { ChangeDetectionStrategy, Component, inject, Input } from "@angular/core"
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
  @Input ( ) public imageURLs: string [ ] = [ ]
  @Input ( ) public index: number = 0

  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public close ( ) {
    this.dialogRef.close ( )
  }

  public nextImage ( ) {
    if ( this.index === this.imageURLs.length - 1 ) {
      this.index = 0
    } else this.index++
  }

  public prevImage ( ) {
    if ( this.index === 0 ) {
      this.index = this.imageURLs.length - 1
    } else this.index--
  }
}