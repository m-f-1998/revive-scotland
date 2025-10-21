import { ChangeDetectionStrategy, Component, inject, input, InputSignal, signal } from "@angular/core"
import { NgbModal, NgbModalModule } from "@ng-bootstrap/ng-bootstrap"
import { ExpandedImageComponent } from "@components/expanded-image/expanded-image.component"
import { IconService } from "@services/icons.service"

@Component ( {
  selector: "app-image-slider",
  imports: [
    NgbModalModule
  ],
  templateUrl: "./image-slider.component.html",
  styleUrl: "./image-slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ImageSliderComponent {
  public imageURLs: InputSignal<string[]> = input<string[]> ( [ ] )

  public zoom = 10
  public loading = signal ( false )

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public expandImage ( index: number ) {
    const reference = this.modalSvc.open ( ExpandedImageComponent, { size: "lg", centered: true } )
    reference.componentInstance.imageURLs = this.imageURLs ( )
    reference.componentInstance.index = index
  }
}
