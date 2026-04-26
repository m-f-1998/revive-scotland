import { ChangeDetectionStrategy, Component, inject, input, InputSignal, signal } from "@angular/core"
import { NgbModal, NgbModalModule } from "@ng-bootstrap/ng-bootstrap"
import { ExpandedImageComponent } from "@components/expanded-image/expanded-image.component"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { Router } from "@angular/router"

@Component ( {
  selector: "app-image-slider",
  imports: [
    NgbModalModule,
    IconComponent
  ],
  templateUrl: "./image-slider.component.html",
  styleUrl: "./image-slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ImageSliderComponent {
  public imageURLs: InputSignal<string[]> = input<string[]> ( [ ] )

  public zoom = 10
  public loading = signal ( false )

  private readonly modalSvc: NgbModal = inject ( NgbModal )
  private readonly router: Router = inject ( Router )

  public expandImage ( index: number ) {
    const reference = this.modalSvc.open ( ExpandedImageComponent, { size: "lg", centered: true } )
    reference.componentInstance.imageURLs = this.imageURLs ( )
    reference.componentInstance.index = index
  }

  public goToGallery ( ) {
    this.router.navigate ( [ "/gallery" ] )
  }

}
