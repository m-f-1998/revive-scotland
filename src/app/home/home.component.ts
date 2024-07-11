import { Component } from "@angular/core"
import { SliderComponent } from "@components/slider/slider.component"
import { TestimonyComponent } from "@components/testimony/testimony.component"
import { AboutUsComponent } from "@components/about-us/about-us.component"
import { OurStoryComponent } from "@components/our-story/our-story.component"
import { PilgramagesComponent } from "@components/pilgramages/pilgramages.component"
import { AdorationMissionsComponent } from "@components/adoration-missions/adoration-missions.component"
import { DonateComponent } from "@components/donate/donate.component"
import { ContactComponent } from "@components/contact/contact.component"
import { FooterComponent } from "@components/footer/footer.component"
import { ReviveWeekendsComponent } from "@components/revive-weekends/revive-weekends.component"
import { NextEventComponent } from "@components/next-event/next-event.component"

@Component ( {
  selector: "app-home",
  standalone: true,
  imports: [
    SliderComponent,
    TestimonyComponent,
    AboutUsComponent,
    OurStoryComponent,
    PilgramagesComponent,
    AdorationMissionsComponent,
    DonateComponent,
    ContactComponent,
    FooterComponent,
    ReviveWeekendsComponent,
    NextEventComponent
  ],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss"
} )
export class HomeComponent {
}
