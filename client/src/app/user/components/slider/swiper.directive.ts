import { AfterViewInit, Directive, ElementRef, input, InputSignal } from "@angular/core"
import { SwiperContainer } from "swiper/element"
import { SwiperOptions } from "swiper/types"

@Directive ( {
  selector: "[appFMSwiper]",
  standalone: true,
} )
export class SwiperDirective implements AfterViewInit {
  public readonly config: InputSignal<SwiperOptions | undefined> = input ( )

  public constructor (
    private el: ElementRef<SwiperContainer>
  ) { }

  public ngAfterViewInit ( ) {
    Object.assign ( this.el.nativeElement, this.config ( ) )
    if ( this.el.nativeElement.initialize ) {
      this.el.nativeElement.initialize ( )
    }
  }
}