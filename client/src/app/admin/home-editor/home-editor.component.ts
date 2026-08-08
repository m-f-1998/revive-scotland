import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "@app/icon/icon.component"

import { SliderEditorComponent } from "./components/slider-editor/slider-editor.component"
import { WeekendsEditorComponent } from "./components/weekends-editor/weekends-editor.component"
import { PilgrimageEditorComponent } from "./components/pilgrimage-editor/pilgrimage-editor.component"
import { AdorationEditorComponent } from "./components/adoration-editor/adoration-editor.component"
import { AboutEditorComponent } from "./components/about-editor/about-editor.component"
import { TestimonialsEditorComponent } from "./components/testimonials-editor/testimonials-editor.component"
import { StoryEditorComponent } from "./components/story-editor/story-editor.component"
import { ContactEditorComponent } from "./components/contact-editor/contact-editor.component"
import { DonateEditorComponent } from "./components/donate-editor/donate-editor.component"
import { BrandIcon, SolidIcon } from "src/app/icon/icon.registry"

type EditorTab = "slider" | "about" | "testimonials" | "story" | "adoration" | "pilgrimage" | "weekends" | "contact" | "donate"
const Editor: Array<{ id: EditorTab; label: string; icon: BrandIcon | SolidIcon }> = [
  { id: "slider", label: "Home Slider", icon: "image" },
  { id: "about", label: "About", icon: "info-circle" },
  { id: "testimonials", label: "Testimonials", icon: "share" },
  { id: "story", label: "Our Story", icon: "book-open" },
  { id: "adoration", label: "Adoration", icon: "praying-hands" },
  { id: "pilgrimage", label: "Pilgrimage", icon: "map-marker" },
  { id: "weekends", label: "Revive Weekends", icon: "calendar-days" },
  { id: "donate", label: "Donations", icon: "heart" },
  { id: "contact", label: "Contact Details", icon: "address-card" }
]

@Component ( {
  selector: "app-admin-home-editor",
  imports: [
    AdminNavbarComponent,
    AdminFooterComponent,
    IconComponent,
    SliderEditorComponent,
    WeekendsEditorComponent,
    PilgrimageEditorComponent,
    AdorationEditorComponent,
    AboutEditorComponent,
    TestimonialsEditorComponent,
    StoryEditorComponent,
    ContactEditorComponent,
    DonateEditorComponent
  ],
  templateUrl: "./home-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class HomeEditorComponent {
  public activeTab: WritableSignal<EditorTab> = signal ( "slider" )

  public get types ( ): EditorTab [ ] {
    return Editor.map ( item => item.id ) as EditorTab [ ]
  }

  public labels ( type: EditorTab ): string {
    return Editor.find ( item => item.id === type )?.label ?? ""
  }

  public icons ( type: EditorTab ): BrandIcon | SolidIcon {
    return Editor.find ( item => item.id === type )?.icon ?? "question-circle"
  }

  public setActiveTab ( tab: EditorTab ): void {
    this.activeTab.set ( tab )
  }
}
