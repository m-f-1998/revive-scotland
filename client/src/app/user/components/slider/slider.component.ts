import { ChangeDetectionStrategy, Component, WritableSignal, signal, viewChild, Signal, input, InputSignal } from "@angular/core"
import { NgbCarousel, NgbCarouselModule, NgbSlideEvent } from "@ng-bootstrap/ng-bootstrap"
import { Header } from "@revive/src/app/interfaces/headers.interface"

@Component ( {
  selector: "app-slider",
  imports: [
    NgbCarouselModule
  ],
  templateUrl: "./slider.component.html",
  styleUrl: "./slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SliderComponent {
  public readonly slides: InputSignal<Header[] | undefined> = input<Header[] | undefined> ( [ ] )

  public pauseOnHover = true
  public pauseOnFocus = true
  public readonly activeSlide: WritableSignal<number> = signal ( 0 )

  public readonly carousel: Signal<NgbCarousel | undefined> = viewChild ( "carousel" )
  public readonly readmore: WritableSignal<boolean> = signal ( false )

  public onSlide ( slideEvent: NgbSlideEvent ) {
    const slideIndex = parseInt ( slideEvent.current.replace ( "ngb-slide-", "" ), 10 )
    this.activeSlide.set ( slideIndex )
  }
}
