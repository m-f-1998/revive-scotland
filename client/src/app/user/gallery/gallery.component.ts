import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, computed, inject, signal, Renderer2 } from "@angular/core"
import { ModalService } from "@revive/src/app/services/modal.service"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { ExpandedImageComponent } from "@components/expanded-image/expanded-image.component"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { ApiService } from "@revive/src/app/services/api.service"
import { TitleCasePipe } from "@angular/common"

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
    TitleCasePipe
  ],
  templateUrl: "./gallery.component.html",
  styleUrl: "./gallery.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class GalleryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren ( "galleryImg", { read: ElementRef } ) public images!: QueryList<ElementRef<HTMLImageElement>>

  public filter = computed ( ( ) => this.filterSignal ( ) )

  public galleryNames = computed ( ( ) => Object.keys ( this.galleriesData ( ) ) )

  public filtered = computed<MediaItem [ ]> ( ( ) => {
    const urls = this.galleriesData ( ) [ this.filterSignal ( ) ] ?? [ ]
    return urls.map ( url => {
      const ext = url.split ( "." ).pop ( )?.toLowerCase ( )
      if ( ext === "mp4" ) return { url, type: "video" as const }
      // R2 share URLs (/api/public/s/...) are served directly — skip the image proxy
      const isShareUrl = url.startsWith ( "/" ) || url.startsWith ( "http" )
      const lqip = isShareUrl ? url : `/api/img/${url}?w=40&f=webp&q=20`
      const src = isShareUrl ? url : `/api/img/${url}?w=800&f=webp`
      const srcset = isShareUrl ? undefined : `/api/img/${url}?w=400&f=webp 400w, /api/img/${url}?w=800&f=webp 800w, /api/img/${url}?w=1200&f=webp 1200w`
      const sizes = `(max-width:600px) 100vw, 33vw`
      return { url, type: "image" as const, lqip, src, srcset, sizes }
    } )
  } )

  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly renderer: Renderer2 = inject ( Renderer2 )

  private galleriesData = signal<Record<string, string [ ]>> ( { } )
  private filterSignal = signal<string> ( "" )
  private io: IntersectionObserver | null = null

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/gallery" ).then ( data => {
      const galleries = data as Record<string, string [ ]>
      this.galleriesData.set ( galleries )
      const keys = Object.keys ( galleries )
      if ( keys.length > 0 ) this.filterSignal.set ( keys [ 0 ] )
    } )
  }

  public ngAfterViewInit ( ): void {
    this.initializeObserver ( )
    this.observeImages ( )
    this.images.changes.subscribe ( ( ) => this.observeImages ( ) )
  }

  public ngOnDestroy ( ): void {
    if ( this.io ) {
      try { this.io.disconnect ( ) } catch { /* ignore */ }
      this.io = null
    }
  }

  public openItem ( index: number ) {
    const items = this.filtered ( ).map ( m => ( { url: m.url, type: m.type } ) )
    const reference = this.modalSvc.open ( ExpandedImageComponent, { lightbox: true } )
    reference.setInput ( "items", items )
    reference.setInput ( "index", index )
    reference.result.catch ( ( ) => { /* ignore */ } )
  }

  public setFilter ( f: string ) {
    this.filterSignal.set ( f )
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
        const onLoad = ( ) => {
          this.renderer.removeClass ( img, "progressive" )
          img.removeEventListener ( "load", onLoad )
        }
        if ( img.complete && img.naturalWidth > 0 ) {
          this.renderer.removeClass ( img, "progressive" )
        } else {
          img.addEventListener ( "load", onLoad )
        }
        this.io!.unobserve ( img )
      }
    }, { rootMargin: "400px 0px", threshold: 0.01 } )
  }

  private observeImages ( ) {
    if ( !this.images ) return
    this.initializeObserver ( )
    if ( this.io ) {
      try { this.io.disconnect ( ) } catch { /* ignore */ }
    }
    for ( const el of this.images.toArray ( ) ) {
      const img = el.nativeElement as HTMLImageElement
      if ( img.getAttribute ( "data-loaded" ) === "1" ) continue
      const dataSrc = img.getAttribute ( "data-src" )
      if ( !dataSrc ) {
        const url = img.getAttribute ( "data-url" )
        if ( url ) {
          const isShareUrl = url.startsWith ( "/" ) || url.startsWith ( "http" )
          this.renderer.setAttribute ( img, "data-src", isShareUrl ? url : `/api/img/${url}?w=800&f=webp` )
          if ( !isShareUrl ) {
            this.renderer.setAttribute ( img, "data-srcset", `/api/img/${url}?w=400&f=webp 400w, /api/img/${url}?w=800&f=webp 800w, /api/img/${url}?w=1200&f=webp 1200w` )
          }
        }
      }
      this.io!.observe ( img )
    }
  }
}
