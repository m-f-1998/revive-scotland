import { ChangeDetectionStrategy, Component, inject, Input } from "@angular/core"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"

@Component ( {
  selector: "app-video-modal",
  templateUrl: "./video-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class VideoModalComponent {
  @Input ( ) public videoUrl: string = ""

  public readonly activeRouter: NgbActiveModal = inject ( NgbActiveModal )

  public close ( ) {
    this.activeRouter.dismiss ( )
  }
}
