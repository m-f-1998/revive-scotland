import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, WritableSignal } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "@revive/src/app/services/icons.service"

@Component ( {
  selector: "app-our-story",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./our-story.component.html",
  styleUrl: "./our-story.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class OurStoryComponent implements OnInit, OnDestroy {
  public ourStory = [
    {
      title: "Our Journey",
      description: "At Revive Scotland, our journey is deeply informed by a robust background in catechesis, bolstered by academic achievements including both a BA in Catholic Theology and an MA in Applied Catholic Theology. This academic foundation enriches our understanding and practice of the faith, enabling us to effectively convey its teachings and significance to others."
    },
    {
      bullet: true,
      title: "Youth Work",
      description: "Our commitment to youth work under the patronage of St John Bosco extends beyond mere engagement, encompassing a holistic approach to nurturing spiritual growth and real friendships."
    },
    {
      bullet: true,
      title: "Parish Involvement",
      description: "Alongside organising pilgrimages, Revive Weekends and other events such as our recent trip to World Youth Day, our dedication to parish-related apostolates especially building Eucharistic Adoration and parish youth groups underscore our hands-on involvement in the everyday life of the Church."
    },
    {
      bullet: true,
      title: "Leadership Training",
      description: "We take pride in fostering transformative spaces through the development and leadership of children's, youth, and young adults groups, providing avenues for exploration and growth in the Catholic faith. Furthermore, we provide comprehensive leadership training for youth group leaders, empowering them to effectively guide and mentor others in their spiritual journeys."
    },
    {
      title: "Eucharistic Adoration",
      description: "Because of our experience in organising and leading Eucharistic adoration at both parish and mission levels, we are steadfast in our commitment to fostering deep reverence and devotion within our communities. At Revive Scotland, we are dedicated to inspiring spiritual renewal and fostering community cohesion, drawing upon our diverse backgrounds and experiences to serve as catalysts for transformation and growth."
    }
  ]

  public readonly readmore: WritableSignal<boolean> = signal ( false )
  public readonly screenWidth: WritableSignal<number> = signal ( window.innerWidth )

  public readonly iconSvc: IconService = inject ( IconService )

  public ngOnInit ( ) {
    window.addEventListener ( "resize", this.onResize.bind ( this ) )
    this.onResize ( )
  }

  public ngOnDestroy ( ) {
    window.removeEventListener ( "resize", this.onResize.bind ( this ) )
  }

  public getStorySubset ( ) {
    if ( this.screenWidth ( ) > 992 ) {
      return this.ourStory
    } else {
      return this.ourStory.slice ( 0, this.readmore ( ) ? this.ourStory.length : 2 )
    }
  }

  public onResize ( ) {
    this.readmore.set ( false )
    this.screenWidth.set ( window.innerWidth )
  }

  public toggleReadMore ( ) {
    this.readmore.set ( !( this.readmore ( ) ) )
  }

}
