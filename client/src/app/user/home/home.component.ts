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
      image: "kinloss/kinloss-13.jpg"
    },
    {
      title: "Join the Prayer",
      content: "Revive exists to give people a real and transformational HOPE, through a FAITH filled lifestyle centered on the sacraments, catechesis and real authentic friendships as a way to encounter God's LOVE.",
      image: "kinloss/kinloss-9.jpg"
    },
    {
      title: "God is Love",
      content: "'Let anyone who is thirsty come to me and drink. Whoever believes in me, as Scripture has said, rivers of living water will flow from within them. By this he meant the Holy Spirit' (Jn 7:38-39)",
      image: "kinloss/kinloss-2.jpg"
    }
  ]

  public imageURLs: Array<string> = [
    "dunoon/dunoon-1.jpg",
    "dunoon/dunoon-22.jpg",
    "dunoon/dunoon-24.jpg",
    "kinloss/kinloss-2.jpg",
    "kinloss/kinloss-4.jpg",
    "kinloss/kinloss-5.jpg",
    "skye/skye-1.jpg",
    "skye/skye-3.jpg",
    "skye/skye-5.jpg"
  ]
}
