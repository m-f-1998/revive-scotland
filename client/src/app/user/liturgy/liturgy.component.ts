import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { SliderComponent } from "../components/slider/slider.component"
import { IconComponent } from "../../icon/icon.component"
import { DomSanitizer, SafeHtml } from "@angular/platform-browser"
import { Prayer, CategoryLabel, TypeLabel, PrayerType, PrayerCategory } from "./liturgy.interface"
import { ResourcesStateService } from "../../services/resources-state.service"

enum ContentType {
  Prayer = "prayer",
  Readings = "readings",
  Reflections = "reflections"
}

@Component ( {
  selector: "app-liturgy",
  imports: [ NavbarComponent, FooterComponent, SliderComponent, IconComponent ],
  templateUrl: "./liturgy.component.html",
  styleUrl: "./liturgy.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class LiturgyComponent implements OnInit {
  public readonly state = inject ( ResourcesStateService )

  public selectedPrayer: WritableSignal<Prayer | null> = signal ( null )
  public showLatin: WritableSignal<boolean> = signal ( false )
  public contentToShow: WritableSignal<ContentType> = signal ( ContentType.Readings )
  public activeReadingTab: WritableSignal<"firstReading" | "secondReading" | "psalm" | "gospelAcclamation" | "gospel"> = signal ( "firstReading" )
  public selectedReading: WritableSignal<{ title: string; content: SafeHtml } | null> = signal ( null )

  public readonly slides = [
    {
      title: "Liturgy & Prayers",
      content: "Deepen your faith with prayers, video reflections, and today's Mass from the Scottish liturgical calendar.",
      image: "gallery/kinloss/kinloss-13.jpg"
    }
  ]

  public readonly feastNeutralAccent = computed ( ( ) =>
    this.darkMode ( ) ? "#F9FAFB" : "#111827"
  )

  public readonly safeReadings = computed ( ( ) => {
    const r = this.state.feast ( )?.readings
    if ( !r ) return null
    return {
      firstReading: r.firstReading ? this.sanitizer.bypassSecurityTrustHtml ( r.firstReading ) : null,
      firstReadingSource: r.firstReadingSource ? this.sanitizer.bypassSecurityTrustHtml ( r.firstReadingSource ) : null,
      secondReading: r.secondReading ? this.sanitizer.bypassSecurityTrustHtml ( r.secondReading ) : null,
      secondReadingSource: r.secondReadingSource ? this.sanitizer.bypassSecurityTrustHtml ( r.secondReadingSource ) : null,
      psalm: r.psalm ? this.sanitizer.bypassSecurityTrustHtml ( r.psalm ) : null,
      psalmSource: r.psalmSource ? this.sanitizer.bypassSecurityTrustHtml ( r.psalmSource ) : null,
      gospelAcclamation: r.gospelAcclamation ? this.sanitizer.bypassSecurityTrustHtml ( r.gospelAcclamation ) : null,
      gospelAcclamationSource: r.gospelAcclamationSource ? this.sanitizer.bypassSecurityTrustHtml ( r.gospelAcclamationSource ) : null,
      gospel: r.gospel ? this.sanitizer.bypassSecurityTrustHtml ( r.gospel ) : null,
      gospelSource: r.gospelSource ? this.sanitizer.bypassSecurityTrustHtml ( r.gospelSource ) : null,
      copyright: r.copyright ? this.sanitizer.bypassSecurityTrustHtml ( r.copyright ) : null,
    }
  } )

  private readonly sanitizer = inject ( DomSanitizer )

  // Reactive dark mode signal — updates when OS preference changes
  private readonly darkMode: WritableSignal<boolean> = signal (
    window.matchMedia ( "(prefers-color-scheme: dark)" ).matches
  )

  public get contentType ( ): typeof ContentType {
    return ContentType
  }

  public get getCategoryLabel ( ): Record<string, string> {
    return CategoryLabel
  }

  public get getTypeLabel ( ): Record<PrayerType, string> {
    return TypeLabel
  }

  public ngOnInit ( ): void {
    const mq = window.matchMedia ( "(prefers-color-scheme: dark)" )
    mq.addEventListener ( "change", e => this.darkMode.set ( e.matches ) )

    this.state.loadInitialData ( )
  }

  public openPrayer ( prayer: Prayer ): void {
    this.selectedPrayer.set ( prayer )
    this.showLatin.set ( false )
    document.body.style.overflow = "hidden"
  }

  public openReading ( title: string, content: SafeHtml ): void {
    this.selectedReading.set ( { title, content } )
    document.body.style.overflow = "hidden"
  }

  public closeReading ( ): void {
    this.selectedReading.set ( null )
    document.body.style.overflow = ""
  }

  public closePrayer ( ): void {
    this.selectedPrayer.set ( null )
    document.body.style.overflow = ""
  }

  public formatCategory ( value: PrayerCategory ): string {
    return CategoryLabel [ value ] ?? value
  }

  public formatType ( value: PrayerType ): string {
    return TypeLabel [ value ] ?? value
  }

  public prayerPreview ( text: string ): string {
    return text.split ( "\n" ) [ 0 ] ?? ""
  }

  public youtubeThumb ( id: string ): string {
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`
  }

  public youtubeUrl ( id: string ): string {
    return `https://www.youtube.com/watch?v=${id}`
  }
}

