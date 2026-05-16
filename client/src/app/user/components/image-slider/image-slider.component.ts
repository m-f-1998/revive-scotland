import { ChangeDetectionStrategy, Component, computed, inject, input, InputSignal } from "@angular/core"
import { ModalService } from "@revive/src/app/services/modal.service"
import { ExpandedImageComponent } from "@components/expanded-image/expanded-image.component"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { Router } from "@angular/router"

const GALLERY_LIMIT = 8

@Component ( {
  selector: "app-image-slider",
  imports: [
    IconComponent
  ],
  templateUrl: "./image-slider.component.html",
  styleUrl: "./image-slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ImageSliderComponent {
  public imageURLs: InputSignal<string[]> = input<string[]> ( [ ] )

  public readonly visibleURLs = computed ( ( ) => this.imageURLs ( ).slice ( 0, GALLERY_LIMIT ) )

  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly router: Router = inject ( Router )

  public imgSrc ( url: string, w: number ): string {
    if ( url.startsWith ( "/" ) || url.startsWith ( "http" ) ) return url
    return `/api/img/${url}?w=${w}&f=webp`
  }

  public imgSrcset ( url: string ): string | undefined {
    if ( url.startsWith ( "/" ) || url.startsWith ( "http" ) ) return undefined
    return `/api/img/${url}?w=320&f=webp 320w, /api/img/${url}?w=640&f=webp 640w`
  }

  public expandImage ( index: number ) {
    const items = this.visibleURLs ( ).map ( url => ( { url, type: "image" as const } ) )
    const reference = this.modalSvc.open ( ExpandedImageComponent, { lightbox: true } )
    reference.setInput ( "items", items )
    reference.setInput ( "index", index )
    reference.result.catch ( ( ) => { /* ignore */ } )
  }

  public goToGallery ( ) {
    this.router.navigate ( [ "/gallery" ] )
  }

}
