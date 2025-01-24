import { AfterViewInit, ApplicationRef, Directive, ElementRef, Input } from "@angular/core"
import { first } from "rxjs"
import { SwiperContainer } from "swiper/element"
import { SwiperOptions } from "swiper/types"

@Directive ( {
  selector: "[appFMSwiper]",
  standalone: true,
} )
export class SwiperDirective implements AfterViewInit {
  private readonly swiperElement: HTMLElement
  @Input (  ) public config?: SwiperOptions

  public constructor (
    private el: ElementRef<SwiperContainer>,
    private appRef: ApplicationRef
  ) {
    this.swiperElement = el.nativeElement
  }

  public ngAfterViewInit ( ) {
    Object.assign ( this.el.nativeElement, this.config )
    this.appRef.isStable.pipe ( first ( ( isStable ) => isStable ) ).subscribe ( ( ) => {
      if ( this.el.nativeElement.initialize )
        this.el.nativeElement.initialize ( )
    } )
  }
}