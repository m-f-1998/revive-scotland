import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, WritableSignal } from "@angular/core"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { ApiService } from "@revive/src/app/services/api.service"

interface StoryItem {
  description: string
  bullet?: boolean
}

const FALLBACK: StoryItem [ ] = [
  {
    description: "At Revive Scotland, our journey is deeply informed by a robust background in catechesis, bolstered by academic achievements including both a BA in Catholic Theology and an MA in Applied Catholic Theology. This academic foundation enriches our understanding and practice of the faith, enabling us to effectively convey its teachings and significance to others."
  },
  {
    bullet: true,
    description: "Our commitment to youth work under the patronage of St John Bosco extends beyond mere engagement, encompassing a holistic approach to nurturing spiritual growth and real friendships."
  },
  {
    bullet: true,
    description: "Alongside organising pilgrimages, Revive Weekends and other events such as our recent trip to World Youth Day, our dedication to parish-related apostolates especially building Eucharistic Adoration and parish youth groups underscore our hands-on involvement in the everyday life of the Church."
  },
  {
    bullet: true,
    description: "We take pride in fostering transformative spaces through the development and leadership of children's, youth, and young adults groups, providing avenues for exploration and growth in the Catholic faith. Furthermore, we provide comprehensive leadership training for youth group leaders, empowering them to effectively guide and mentor others in their spiritual journeys."
  },
  {
    description: "Because of our experience in organising and leading Eucharistic adoration at both parish and mission levels, we are steadfast in our commitment to fostering deep reverence and devotion within our communities. At Revive Scotland, we are dedicated to inspiring spiritual renewal and fostering community cohesion, drawing upon our diverse backgrounds and experiences to serve as catalysts for transformation and growth."
  }
]

@Component ( {
  selector: "app-our-story",
  imports: [ IconComponent ],
  templateUrl: "./our-story.component.html",
  styleUrl: "./our-story.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class OurStoryComponent implements OnInit, OnDestroy {
  public ourStory: WritableSignal<StoryItem [ ]> = signal ( FALLBACK )
  public readonly readmore: WritableSignal<boolean> = signal ( false )
  public readonly screenWidth: WritableSignal<number> = signal ( window.innerWidth )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    window.addEventListener ( "resize", this.onResize.bind ( this ) )
    this.onResize ( )

    this.apiSvc.get ( "/api/admin/our-story" ).then ( data => {
      const res = data as { items: StoryItem [ ] }
      if ( res.items?.length ) {
        this.ourStory.set ( res.items )
      }
    } ).catch ( ( ) => { /* keep fallback */ } )
  }

  public ngOnDestroy ( ): void {
    window.removeEventListener ( "resize", this.onResize.bind ( this ) )
  }

  public onResize ( ): void {
    this.readmore.set ( false )
    this.screenWidth.set ( window.innerWidth )
  }

  public toggleReadMore ( ): void {
    this.readmore.set ( !this.readmore ( ) )
  }
}
