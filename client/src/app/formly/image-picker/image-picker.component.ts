import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { IconService } from "../../services/icons.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FileExplorerComponent } from "../../admin/file-explorer/file-explorer.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"

@Component ( {
  selector: "app-formly-image-picker",
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FaIconComponent
  ],
  templateUrl: "./image-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ImagePickerComponent extends FieldType implements OnInit {
  public readonly iconSvc: IconService = inject ( IconService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public ngOnInit ( ): void {
    if ( !this.formControl?.value ) {
      this.formControl?.setValue ( "" )
    }
  }

  public openFileSelector ( ): void {
    const modalRef = this.modalSvc.open ( FileExplorerComponent, { size: "xl", centered: true } )

    modalRef.componentInstance.isSelectionMode = true

    modalRef.result.then ( ( result: string | undefined ) => {
      if ( result ) {
        this.formControl?.setValue ( result )
      }
    } ).catch ( ( ) => { /* Modal dismissed */ } )
  }
}