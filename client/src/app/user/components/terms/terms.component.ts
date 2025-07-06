import { ChangeDetectionStrategy, Component, inject } from "@angular/core"
import { NgbActiveModal, NgbModule } from "@ng-bootstrap/ng-bootstrap"
import { DatesService } from "@revive/src/app/services/dates.service"

@Component ( {
  selector: "app-terms",
  imports: [
    NgbModule
  ],
  templateUrl: "./terms.component.html",
  styleUrl: "./terms.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TermsComponent {
  public contact = "luca@revivescotland.co.uk"
  public lastUpdated = new Date ( 2025, 1, 12 )

  public readonly dateSvc: DatesService = inject ( DatesService )
  private readonly modalRef: NgbActiveModal = inject ( NgbActiveModal )

  public close ( ) {
    this.modalRef.close ( )
  }
}
