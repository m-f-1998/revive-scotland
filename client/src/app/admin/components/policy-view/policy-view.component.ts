import { ChangeDetectionStrategy, Component, Input } from "@angular/core"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"

@Component ( {
  selector: "app-admin-policy-view",
  templateUrl: "./policy-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PolicyViewComponent {
  @Input ( ) public title: any = ""
  @Input ( ) public description: any = ""

  public faSpinner = faSpinner

  public constructor (
    private activeModal: NgbActiveModal
  ) { }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
