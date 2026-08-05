import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"
import { IconComponent } from "../../../icon/icon.component"

@Component ( {
  selector: "app-success-modal",
  imports: [ IconComponent ],
  templateUrl: "./success-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SuccessModalComponent {
  public eventTitle = input ( "" )
  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public close ( ): void {
    this.dialogRef.close ( )
  }
}
