import { AfterViewInit, ApplicationRef, Directive, ElementRef, Input, inject } from "@angular/core"
import { first } from "rxjs"
import { SwiperContainer } from "swiper/element"
import { SwiperOptions } from "swiper/types"

@Directive ( {
  selector: "[fmSwiper]",
  standalone: true,
} )
export class SwiperDirective implements AfterViewInit {
  private readonly swiperElement: HTMLElement
  @Input ( "config" ) config?: SwiperOptions

  constructor (
    private el: ElementRef<SwiperContainer>,
    private appRef: ApplicationRef
  ) {
    this.swiperElement = el.nativeElement
  }

  ngAfterViewInit ( ) {
    Object.assign ( this.el.nativeElement, this.config )
    this.appRef.isStable.pipe ( first ( ( isStable ) => isStable ) ).subscribe ( ( ) => {
      if ( this.el.nativeElement.initialize )
        this.el.nativeElement.initialize ( )
    } )
  }
}