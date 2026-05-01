import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, QueryList, ViewChildren, inject, signal, Renderer2 } from "@angular/core"
import { NgbModal, NgbModalModule } from "@ng-bootstrap/ng-bootstrap"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { ExpandedImageComponent } from "@components/expanded-image/expanded-image.component"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { VideoModalComponent } from "../components/video-modal/video-modal.component"

type MediaItem = {
  url: string
  type: "image" | "video"
  lqip?: string
  src?: string
  srcset?: string
  sizes?: string
}

@Component ( {
  selector: "app-gallery",
  imports: [
    NavbarComponent,
    FooterComponent,
    IconComponent,
    NgbModalModule
  ],
  templateUrl: "./gallery.component.html",
  styleUrl: "./gallery.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class GalleryComponent implements AfterViewInit, OnDestroy {
  @ViewChildren ( "galleryImg", { read: ElementRef } ) public images!: QueryList<ElementRef<HTMLImageElement>>

  // Simple in-component media list. Each item can be an image (jpg/png) or a video (mp4).
  public galleries = signal ( [
    { url: "dunoon/dunoon-", type: "jpg", gallery: "dunoon", number: 40, startingIndex: 1 },
    { url: "dunoon/dunoon-", type: "mp4", gallery: "dunoon", number: 1, startingIndex: 41 },
    { url: "kinloss/kinloss-", type: "jpg", gallery: "kinloss", number: 13, startingIndex: 1 },
    { url: "kinloss/kinloss-", type: "mp4", gallery: "kinloss", number: 1, startingIndex: 14 },
    { url: "skye/skye-", type: "jpg", gallery: "skye", number: 7, startingIndex: 1 },
  ] )

  public filter = signal<"dunoon" | "kinloss" | "skye"> ( "dunoon" )

  private readonly modalSvc: NgbModal = inject ( NgbModal )
  private readonly renderer: Renderer2 = inject ( Renderer2 )

  private io: IntersectionObserver | null = null

  public get filtered ( ): MediaItem [ ] {
    const f = this.filter ( )
    // Calculate all media urls based on the gallery definitions and types and starting index
    const media: MediaItem [ ] = [ ]
    for ( const gallery of this.galleries ( ) ) {
      if ( gallery.gallery === f ) {
        for ( let i = 0; i < gallery.number; i++ ) {
          const url = gallery.url + ( gallery.startingIndex + i ) + "." + gallery.type
          if ( gallery.type === "mp4" ) {
            media.push ( { url, type: "video" } )
          } else {
            // Prepare LQIP and responsive srcset
            const lqip = `/api/img/${url}?w=40&f=webp&q=20`
            const src = `/api/img/${url}?w=800&f=webp`
            const srcset = `/api/img/${url}?w=400&f=webp 400w, /api/img/${url}?w=800&f=webp 800w, /api/img/${url}?w=1200&f=webp 1200w`
            const sizes = `(max-width:600px) 100vw, 33vw`
            media.push ( { url, type: "image", lqip, src, srcset, sizes } )
          }
        }
      }
    }
    return media
  }

  public ngAfterViewInit ( ): void {
    this.initializeObserver ( )
    this.observeImages ( )
    // re-observe when QueryList changes (e.g., filter changes)
    this.images.changes.subscribe ( ( ) => this.observeImages ( ) )
  }

  public ngOnDestroy ( ): void {
    if ( this.io ) {
      try { this.io.disconnect ( ) } catch { /* ignore */ }
      this.io = null
    }
  }

  public openImage ( index: number ) {
    const images = this.filtered.filter ( m => m.type === "image" ).map ( m => m.url )
    const reference = this.modalSvc.open ( ExpandedImageComponent, { size: "lg", centered: true } )
    reference.componentInstance.imageURLs = images
    reference.componentInstance.index = index
  }

  public openVideo ( url: string ) {
    const ref = this.modalSvc.open ( VideoModalComponent, { size: "lg", centered: true } )
    ref.componentInstance.videoUrl = url
  }

  public setFilter ( f: "dunoon" | "kinloss" | "skye" ) {
    this.filter.set ( f )
    // When filter changes, images QueryList will update; ensure observer re-attaches
    // small timeout allows view to update before observing
    setTimeout ( ( ) => this.observeImages ( ), 0 )
  }

  private initializeObserver ( ) {
    if ( this.io ) return
    this.io = new IntersectionObserver ( entries => {
      for ( const entry of entries ) {
        if ( !entry.isIntersecting ) continue
        const img = entry.target as HTMLImageElement
        const dataSrc = img.getAttribute ( "data-src" )
        const dataSrcset = img.getAttribute ( "data-srcset" )
        if ( dataSrc ) this.renderer.setAttribute ( img, "src", dataSrc )
        if ( dataSrcset ) this.renderer.setAttribute ( img, "srcset", dataSrcset )
        this.renderer.removeClass ( img, "progressive" )
        this.io!.unobserve ( img )
      }
    }, { rootMargin: "300px 0px", threshold: 0.01 } )
  }

  private observeImages ( ) {
    if ( !this.images ) return
    // ensure observer exists
    this.initializeObserver ( )
    // unobserve any previously observed nodes
    if ( this.io ) {
      try { this.io.disconnect ( ) } catch { /* ignore */ }
    }
    for ( const el of this.images.toArray ( ) ) {
      const img = el.nativeElement as HTMLImageElement
      // If image already has been upgraded to real src, skip
      if ( img.getAttribute ( "data-loaded" ) === "1" ) continue
      // set data attributes if not already set (handles SSR or re-render)
      const dataSrc = img.getAttribute ( "data-src" )
      if ( !dataSrc ) {
        const url = img.getAttribute ( "data-url" )
        if ( url ) {
          this.renderer.setAttribute ( img, "data-src", `/api/img/${url}?w=800&f=webp` )
          this.renderer.setAttribute ( img, "data-srcset", `/api/img/${url}?w=400&f=webp 400w, /api/img/${url}?w=800&f=webp 800w, /api/img/${url}?w=1200&f=webp 1200w` )
        }
      }
      this.io!.observe ( img )
    }
  }
}
