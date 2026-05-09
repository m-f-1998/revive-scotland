import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"

@Component ( {
  selector: "app-video-modal",
  templateUrl: "./video-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class VideoModalComponent {
  public videoUrl = input<string> ( "" )

  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public close ( ) {
    this.dialogRef.close ( )
  }
}
