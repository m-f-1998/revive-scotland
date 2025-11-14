import { ChangeDetectionStrategy, Component } from "@angular/core"
import { SliderComponent } from "@components/slider/slider.component"
import { TestimonyComponent } from "@components/testimony/testimony.component"
import { AboutUsComponent } from "@components/about-us/about-us.component"
import { OurStoryComponent } from "@components/our-story/our-story.component"
import { PilgrimageComponent } from "@components/pilgrimage/pilgrimage.component"
import { AdorationMissionsComponent } from "@components/adoration-missions/adoration-missions.component"
// import { DonateComponent } from "@components/donate/donate.component"
import { ContactComponent } from "@components/contact/contact.component"
import { FooterComponent } from "@components/footer/footer.component"
import { ReviveWeekendsComponent } from "@components/revive-weekends/revive-weekends.component"
import { NextEventComponent } from "@components/next-event/next-event.component"
import { ImageSliderComponent } from "../components/image-slider/image-slider.component"
import { NavbarComponent } from "../components/navbar/navbar.component"

@Component ( {
  selector: "app-home",
  imports: [
    SliderComponent,
    TestimonyComponent,
    ImageSliderComponent,
    AboutUsComponent,
    OurStoryComponent,
    PilgrimageComponent,
    AdorationMissionsComponent,
    // DonateComponent,
    ContactComponent,
    FooterComponent,
    ReviveWeekendsComponent,
    NextEventComponent,
    NavbarComponent
  ],
  templateUrl: "./home.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class HomeComponent {
  public slides = [
    {
      title: "Revive Scotland",
      content: "We are dedicated to reviving the faith in people's hearts through the power of the Holy Spirit. We deliver this through formation, community and prayer; mainly Pilgrimages, Revive Weekends and Eucharistic Adoration.",
      image: "kinloss/event-image-2.jpg"
    },
    {
      title: "Join the Prayer",
      content: "Revive exists to give people a real and transformational HOPE, through a FAITH filled lifestyle centered on the sacraments, catechesis and real authentic friendships as a way to encounter God's LOVE.",
      image: "kinloss/event-image-10.jpg"
    },
    {
      title: "God is Love",
      content: "'Let anyone who is thirsty come to me and drink. Whoever believes in me, as Scripture has said, rivers of living water will flow from within them. By this he meant the Holy Spirit' (Jn 7:38-39)",
      image: "kinloss/event-image-12.jpg"
    }
  ]

  public imageURLs: Array<string> = [
    "kinloss/event-image-14.jpg",
    "kinloss/event-image-3.jpg",
    "kinloss/event-image-13.jpg",
    "kinloss/event-image-4.jpg",
    "kinloss/event-image-6.jpg",
    "kinloss/event-image-7.jpg",
    "kinloss/event-image-8.jpg",
    "kinloss/event-image-9.jpg",
    "kinloss/event-image-11.jpg",
    "kinloss/event-image-5.jpg"
  ]
}
