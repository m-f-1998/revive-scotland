import { ChangeDetectionStrategy, Component, inject, Input } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"

@Component ( {
  selector: "app-video-modal",
  templateUrl: "./video-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class VideoModalComponent {
  @Input ( ) public videoUrl: string = ""

  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public close ( ) {
    this.dialogRef.close ( )
  }
}
