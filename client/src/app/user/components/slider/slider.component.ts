import { ChangeDetectionStrategy, Component, WritableSignal, signal, viewChild, Signal, input, InputSignal } from "@angular/core"
import { NgbCarousel, NgbCarouselModule, NgbSlideEvent } from "@ng-bootstrap/ng-bootstrap"

type Slide = { content: string; image: string }

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
  public readonly slides: InputSignal<Slide[] | undefined> = input<Slide[] | undefined> ( [ ] )
  public readonly subtitle: InputSignal<string | undefined> = input<string | undefined> ( "" )

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
