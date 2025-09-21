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

@Component ( {
  selector: "app-home",
  imports: [
    SliderComponent,
    TestimonyComponent,
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

  public readonly headersSvc: HeadersService = inject ( HeadersService )

  public constructor ( ) {
    this.loadHeaders ( )
  }

  private async loadHeaders ( ) {
    this.slides.set ( await this.headersSvc.getHeaders ( "/" ) || [ ] )
  }
}
