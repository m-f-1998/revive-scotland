import { ChangeDetectionStrategy, Component, WritableSignal, signal, viewChild, Signal, input, InputSignal, OnInit, inject } from "@angular/core"
import { NgbCarousel, NgbCarouselModule, NgbSlideEvent } from "@ng-bootstrap/ng-bootstrap"
import { ApiService } from "@revive/src/app/services/api.service"

type Slide = { title: string; content: string; image: string }

@Component ( {
  selector: "app-slider",
  imports: [
    NgbCarouselModule
  ],
  templateUrl: "./slider.component.html",
  styleUrl: "./slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SliderComponent implements OnInit {
  public readonly defaultSlides: InputSignal<Slide[] | undefined> = input<Slide[] | undefined> ( [ ] )
  public readonly pageid: InputSignal<string> = input.required<string> ( )

  public slides: WritableSignal<Slide[]> = signal ( [ ] )

  public pauseOnHover = true
  public pauseOnFocus = true
  public readonly activeSlide: WritableSignal<number> = signal ( 0 )

  public readonly carousel: Signal<NgbCarousel | undefined> = viewChild ( "carousel" )
  public readonly readmore: WritableSignal<boolean> = signal ( false )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.fetchSlides ( ).then ( ( fetchedSlides: Slide [ ] ) => {
      if ( fetchedSlides.length > 0 ) {
        this.slides.set ( fetchedSlides )
      } else if ( this.defaultSlides ( ) && this.defaultSlides ( )!.length > 0 ) {
        this.slides.set ( this.defaultSlides ( )! )
      }
    } )
  }

  public onSlide ( slideEvent: NgbSlideEvent ) {
    const slideIndex = parseInt ( slideEvent.current.replace ( "ngb-slide-", "" ), 10 )
    this.activeSlide.set ( slideIndex )
  }

  private async fetchSlides ( ): Promise<Slide[]> {
    try {
      const slides = await this.apiSvc.get ( `/api/admin/hero-editor/${this.pageid ( )}` ) as { heroes: {
        id: string
        title: string
        description: string
        url: string
      } [ ] }
      return slides.heroes.map ( hero => ( {
        title: hero.title,
        content: hero.description,
        image: hero.url
      } ) )
    } catch {
      console.error ( "Failed to fetch slides." )
      return [ ]
    }
  }
}
