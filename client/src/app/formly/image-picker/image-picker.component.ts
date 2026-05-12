import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { FileExplorerComponent } from "../../admin/file-explorer/file-explorer.component"
import { ModalService } from "@revive/src/app/services/modal.service"
import { IconComponent } from "../../icon/icon.component"
import { takeUntilDestroyed } from "@angular/core/rxjs-interop"
import { DestroyRef } from "@angular/core"

@Component ( {
  selector: "app-formly-image-picker",
  imports: [
    IconComponent
  ],
  templateUrl: "./image-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ImagePickerComponent extends FieldType implements OnInit {
  public readonly value: WritableSignal<string> = signal ( "" )

  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly destroyRef: DestroyRef = inject ( DestroyRef )

  public get previewUrl ( ): string {
    const val = this.value ( )
    if ( !val ) return ""
    if ( val.startsWith ( "http" ) || val.startsWith ( "/" ) ) return val
    return `/api/img/${val}`
  }

  public get isVideo ( ): boolean {
    return this.previewUrl.toLowerCase ( ).endsWith ( ".mp4" )
  }

  public ngOnInit ( ): void {
    const initial = this.formControl?.value ?? ""
    this.formControl?.setValue ( initial )
    this.value.set ( initial )

    this.formControl.valueChanges
      .pipe ( takeUntilDestroyed ( this.destroyRef ) )
      .subscribe ( v => this.value.set ( v ?? "" ) )
  }

  public openFileSelector ( ): void {
    const modalRef = this.modalSvc.open ( FileExplorerComponent, { size: "lg", centered: true } )

    modalRef.componentInstance.isSelectionMode = true

    modalRef.result.then ( ( result: string | undefined ) => {
      if ( result ) {
        this.formControl?.setValue ( result )
      }
    } ).catch ( ( ) => { /* Modal dismissed */ } )
  }
}