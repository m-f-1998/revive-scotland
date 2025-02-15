import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component } from "@angular/core"
import { Autoplay } from "swiper/modules"
import { SwiperOptions } from "swiper/types"
import { SwiperDirective } from "./swiper.directive"

@Component ( {
  selector: "app-slider",
  imports: [
    SwiperDirective
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  templateUrl: "./slider.component.html",
  styleUrl: "./slider.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SliderComponent {

  public slides: any [ ] = [
    {
      title: "Revive Scotland",
      content: "We are a team dedicated to reviving the faith in people's hearts through the power of the Holy Spirit. We aim to deliver this through formation, community and prayer in variety of ways; mainly Pilgrimages, Revive Weekends and Eucharistic Adoration.",
      image: "assets/img/hero-bg-3.jpg"
    },
    {
      title: "Join the Prayer",
      content: "'Let anyone who is thirsty come to me and drink. Whoever believes in me, as Scripture has said, rivers of living water will flow from within them. By this he meant the Holy Spirit' (Jn 7:38-39)",
      image: "assets/img/hero-bg-2.jpg"
    },
    {
      title: "God is Love",
      content: "Revive exists to give people a real and transformational HOPE, through a FAITH filled lifestyle centered on the sacraments, catechesis and real authentic friendships as a way to encounter God's LOVE.",
      image: "assets/img/hero-bg-1.jpg"
    }
  ]

  public config: SwiperOptions = {
    modules: [
      Autoplay
    ],
    init: false,
    loop: true,
    effect: "slide",
    speed: 800,
    autoplay: {
      delay: 4000
    }
  }

  public isMiniTitle ( slide: any ) {
    return Object.keys ( slide ).includes ( "miniTitle" )
  }

}
