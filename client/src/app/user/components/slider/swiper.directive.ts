import { AfterViewInit, Directive, ElementRef, Input } from "@angular/core"
import { SwiperContainer } from "swiper/element"
import { SwiperOptions } from "swiper/types"

@Directive ( {
  selector: "[appFMSwiper]",
  standalone: true,
} )
export class SwiperDirective implements AfterViewInit {
  @Input (  ) public config?: SwiperOptions

  public constructor (
    private el: ElementRef<SwiperContainer>
  ) { }

  public ngAfterViewInit ( ) {
    Object.assign ( this.el.nativeElement, this.config )
    if ( this.el.nativeElement.initialize ) {
      this.el.nativeElement.initialize ( )
    }
  }
}