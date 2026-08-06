import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"
import { IconComponent } from "../../../icon/icon.component"

@Component ( {
  selector: "app-error-modal",
  imports: [ IconComponent ],
  templateUrl: "./error-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ErrorModalComponent {
  public title = input ( "Error" )
  public message = input ( "Something went wrong." )
  public type = input<"error" | "warning"> ( "error" )
  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public close ( ): void {
    this.dialogRef.close ( )
  }
}
