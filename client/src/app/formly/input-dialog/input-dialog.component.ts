import { ChangeDetectionStrategy, Component, Input, inject } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { IconService } from "../../services/icons.service"

@Component ( {
  selector: "iqx-input-dialog",
  imports: [
    FormlyForm,
    FaIconComponent
  ],
  templateUrl: "./input-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class InputDialogComponent {
  @Input ( ) public body = ""
  @Input ( ) public title = ""
  @Input ( ) public confirmText = "Confirm"
  @Input ( ) public cancelText = "Cancel"
  @Input ( ) public fields: FormlyFieldConfig [ ] = [ ]
  @Input ( ) public model: any = { }

  public form = new FormGroup ( { } )
  public description = ""

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly activeModal: NgbActiveModal = inject ( NgbActiveModal )

  public close ( ) {
    this.activeModal.dismiss ( )
  }

  public confirm ( ) {
    if ( this.form.invalid ) {
      return
    }
    this.activeModal.close ( this.model )
  }

}