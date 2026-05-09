import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { ApiService } from "@revive/src/app/services/api.service"

interface Testimony {
  name: string
  testimony: string
}

const FALLBACK: Testimony [ ] = [
  { name: "Largs - 2023", testimony: "I loved the talks and company and the overall structure of the retreat. Incredible experience." },
  { name: "Hawick - 2023", testimony: "This has made me want to create better friendships and discipleship in our parishes and to become a light for our communities" },
  { name: "Largs - 2023", testimony: "There was a lot of time for adoration and the games were great fun, the talks were amazing and it was a great choice of topics and speakers" },
  { name: "Largs - 2023", testimony: "The schedule was well organised, the food was well-organised and the talks were very interesting – I loved the testimonies from the priests" },
  { name: "Dunoon - 2026", testimony: "The content has given me a new perspective on scripture, the mass and liturgy which helps me to appreciate more fully its inherent beauty" },
  { name: "Dunoon - 2026", testimony: "I have grown in a deeper understanding of a relationship with God and others" },
  { name: "Dunoon - 2026", testimony: "I had new revelations about my faith and how I can grow and improve my relationship with God and others" },
  { name: "Dunoon - 2026", testimony: "This weekend made me rediscover myself in the light of God and the needs I can work on! Thank you so much for organising, I really enjoyed being a part of this community" },
  { name: "Dunoon - 2026", testimony: "I have learnt so much over the weekend. Going into detail about dissonant needs has helped me clarify things to address in my own life and how to work on them. I found this retreat very fruitful" },
  { name: "Dunoon - 2026", testimony: "I have been able to surrender to the will of God more" },
  { name: "Dunoon - 2026", testimony: "Finding out how men and women most closely imitate the Blessed Trinity when they're embracing in marital union was so healing and such a beautiful truth that has been revealed to me this weekend!" },
  { name: "Dunoon - 2026", testimony: "Very profound encounter with the goodness of God and His plan for human relationships, marriage and liturgy. Father's talks were deep but relatable and I loved the vulnerability of the men's groups discussion." }
]

@Component ( {
  selector: "app-testimony",
  templateUrl: "./testimony.component.html",
  styleUrl: "./testimony.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TestimonyComponent implements OnInit {
  public displayedTestimonies: WritableSignal<Testimony [ ]> = signal ( [ ] )
  private readonly allTestimonies: WritableSignal<Testimony [ ]> = signal ( FALLBACK )
  private readonly apiSvc: ApiService = inject ( ApiService )

  private pickRandom ( ): void {
    this.displayedTestimonies.set (
      [ ...this.allTestimonies ( ) ].sort ( ( ) => 0.5 - Math.random ( ) ).slice ( 0, 4 )
    )
  }

  public ngOnInit ( ): void {
    this.pickRandom ( )
    this.apiSvc.get ( "/api/admin/site-content/testimonials" ).then ( data => {
      const res = data as { items?: Testimony [ ] }
      if ( res.items?.length ) {
        this.allTestimonies.set ( res.items )
        this.pickRandom ( )
      }
    } ).catch ( ( ) => { /* keep fallback */ } )
  }
}
