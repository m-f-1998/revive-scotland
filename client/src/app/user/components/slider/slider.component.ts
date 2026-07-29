import { ChangeDetectionStrategy, Component, WritableSignal, signal, input, InputSignal, OnInit, OnDestroy, inject } from "@angular/core"
import { ApiService } from "@revive/src/app/services/api.service"

type Slide = { title: string; content: string; image: string }

@Component ( {
  selector: "app-slider",
  templateUrl: "./slider.component.html",
  styleUrl: "./slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SliderComponent implements OnInit, OnDestroy {
  public readonly defaultSlides: InputSignal<Slide[] | undefined> = input<Slide[] | undefined> ( [ ] )
  public readonly pageid: InputSignal<string> = input.required<string> ( )

  public slides: WritableSignal<Slide[]> = signal ( [ ] )
  public readonly activeSlide: WritableSignal<number> = signal ( 0 )

  private intervalId: ReturnType<typeof setInterval> | null = null
  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.fetchSlides ( ).then ( ( fetchedSlides: Slide [ ] ) => {
      if ( fetchedSlides.length > 0 ) {
        this.slides.set ( fetchedSlides )
      } else if ( this.defaultSlides ( ) && this.defaultSlides ( )!.length > 0 ) {
        this.slides.set ( this.defaultSlides ( )! )
      }
      this.startAutoPlay ( )
    } )
  }

  public ngOnDestroy ( ): void {
    this.stopAutoPlay ( )
  }

  public goToSlide ( index: number ): void {
    this.activeSlide.set ( index )
    this.stopAutoPlay ( )
    this.startAutoPlay ( )
  }

  private startAutoPlay ( ): void {
    if ( this.slides ( ).length <= 1 ) return
    this.intervalId = setInterval ( ( ) => {
      this.activeSlide.update ( i => ( i + 1 ) % this.slides ( ).length )
    }, 5000 )
  }

  private stopAutoPlay ( ): void {
    if ( this.intervalId !== null ) {
      clearInterval ( this.intervalId )
      this.intervalId = null
    }
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
