import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"
import { DatesService } from "@revive/src/app/services/dates.service"

@Component ( {
  selector: "app-terms",
  templateUrl: "./terms.component.html",
  styleUrl: "./terms.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TermsComponent {
  public contact = "luca@revivescotland.co.uk"
  public lastUpdated = new Date ( 2025, 1, 12 )

  public readonly dateSvc: DatesService = inject ( DatesService )
  private readonly dialogRef: DialogRef = inject ( DialogRef )

  public close ( ) {
    this.dialogRef.close ( )
  }
}
