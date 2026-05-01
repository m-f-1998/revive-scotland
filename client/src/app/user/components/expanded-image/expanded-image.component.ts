
import { ChangeDetectionStrategy, Component, inject, Input } from "@angular/core"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
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

  public readonly activeRouter: NgbActiveModal = inject ( NgbActiveModal )

  public close ( ) {
    this.activeRouter.dismiss ( )
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