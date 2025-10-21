import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
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
import { NavbarComponent } from "../components/navbar/navbar.component"
import { Header } from "../../interfaces/headers.interface"
import { HeadersService } from "../../services/headers.service"
import { ImageSliderComponent } from "../components/image-slider/image-slider.component"

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
    NavbarComponent,
    ContactComponent,
    FooterComponent,
    ReviveWeekendsComponent,
    NextEventComponent
  ],
  templateUrl: "./home.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class HomeComponent {
  public slides: WritableSignal<Header [ ]> = signal ( [ ] )
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

  public readonly headersSvc: HeadersService = inject ( HeadersService )

  public constructor ( ) {
    this.loadHeaders ( )
  }

  private async loadHeaders ( ) {
    this.slides.set ( await this.headersSvc.getHeaders ( "/" ) || [ ] )
  }
}
