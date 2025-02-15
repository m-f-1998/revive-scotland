import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component } from "@angular/core"
import { Autoplay } from "swiper/modules"
import { SwiperOptions } from "swiper/types"
import { SwiperDirective } from "../../components/slider/swiper.directive"

@Component ( {
  selector: "app-events-slider",
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
export class EventSliderComponent {

  public slides: any [ ] = [
    {
      title: "Upcoming Events",
      image: "assets/img/hero-bg-3.jpg"
    },
    {
      miniTitle: "Skye Pilgrimage",
      image: "assets/img/hero-bg-4.jpg"
    },
    {
      miniTitle: "World Youth Day",
      image: "assets/img/hero-bg-5.jpg"
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
