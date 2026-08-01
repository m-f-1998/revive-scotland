import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { SliderComponent } from "../components/slider/slider.component"
import { IconComponent } from "../../icon/icon.component"
import { ApiService } from "@revive/src/app/services/api.service"
import { DomSanitizer, SafeHtml } from "@angular/platform-browser"
import { Prayer, Reflection, FeastDay, ColourMap, CategoryLabel, CategoryOrder, TypeLabel, PrayerType, PrayerCategory } from "./resources.interface"

enum ContentType {
  Prayer = "prayer",
  Readings = "readings",
  Reflections = "reflections"
}

@Component ( {
  selector: "app-resources",
  imports: [ NavbarComponent, FooterComponent, SliderComponent, IconComponent ],
  templateUrl: "./resources.component.html",
  styleUrl: "./resources.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ResourcesComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public prayers: WritableSignal<Prayer [ ]> = signal ( [ ] )
  public reflections: WritableSignal<Reflection [ ]> = signal ( [ ] )
  public feast: WritableSignal<FeastDay | null> = signal ( null )

  public reflectionFilter: WritableSignal<string> = signal ( "all" )
  public selectedPrayer: WritableSignal<Prayer | null> = signal ( null )
  public showLatin: WritableSignal<boolean> = signal ( false )
  public contentToShow: WritableSignal<ContentType> = signal ( ContentType.Readings )
  public selectedPrayerCategory: WritableSignal<string> = signal ( "our-lord" )
  public activeReadingTab: WritableSignal<"firstReading" | "secondReading" | "psalm" | "gospelAcclamation" | "gospel"> = signal ( "firstReading" )

  public readonly categorisedPrayers = computed ( ( ) =>
    CategoryOrder
      .map ( cat => ( {
        key: cat,
        label: CategoryLabel [ cat ],
        prayers: this.prayers ( ).filter ( p => p.category === cat )
      } ) )
      .filter ( c => c.prayers.length > 0 )
  )

  public readonly activePrayers = computed ( ( ) => {
    const groups = this.categorisedPrayers ( )
    const selected = this.selectedPrayerCategory ( )
    return groups.find ( g => g.key === selected ) ?? groups [ 0 ] ?? null
  } )

  public readonly activePrayerKey = computed ( ( ) => this.activePrayers ( )?.key ?? "" )

  public readonly filteredReflections = computed ( ( ) => {
    const cat = this.reflectionFilter ( )
    return this.reflections ( ).filter ( r => cat === "all" || r.category === cat )
  } )

  public readonly categoryKeys = computed ( ( ) =>
    this.categorisedPrayers ( ).map ( c => c.key ) as ( keyof typeof CategoryLabel ) [ ]
  )

  public readonly feastColourHex = computed ( ( ) => {
    const colour = this.feast ( )?.colour ?? "Green"
    return ColourMap [ colour ] ?? ColourMap [ "Green" ]
  } )

  // For white vestments, borders and text use near-black so the badge stands out
  public readonly feastAccentColour = computed ( ( ) =>
    this.feast ( )?.colour === "White" ? "#111827" : this.feastColourHex ( )
  )

  public readonly isNeutralVestment = computed ( ( ) => {
    const colour = this.feast ( )?.colour ?? ""
    return colour === "White" || colour === "Black"
  } )

  public readonly feastNeutralAccent = computed ( ( ) =>
    this.darkMode ( ) ? "#F9FAFB" : "#111827"
  )

  public readonly safeReadings = computed ( () => {
    const r = this.feast ()?.readings
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

  public readonly slides = [
    {
      title: "Liturgy & Prayers",
      content: "Deepen your faith with prayers, video reflections, and today's Mass from the Scottish liturgical calendar.",
      image: "gallery/kinloss/kinloss-13.jpg"
    }
  ]

  public selectedReading: WritableSignal<{ title: string; content: SafeHtml } | null> = signal ( null )

  private readonly sanitizer = inject ( DomSanitizer )

  // Reactive dark mode signal — updates when OS preference changes
  private readonly darkMode: WritableSignal<boolean> = signal (
    window.matchMedia ( "(prefers-color-scheme: dark)" ).matches
  )

  private readonly apiSvc: ApiService = inject ( ApiService )

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

    Promise.all ( [
      this.apiSvc.get ( "/api/admin/prayers" ).catch ( ( ) => ( { prayers: [ ] } ) ),
      this.apiSvc.get ( "/api/admin/reflections" ).catch ( ( ) => ( { reflections: [ ] } ) ),
      this.apiSvc.get ( "/api/feast" ).catch ( ( ) => null )
    ] ).then ( ( [ prayerData, reflectionData, feastData ] ) => {
      const pd = prayerData as { prayers?: Prayer [ ] }
      const rd = reflectionData as { reflections?: Reflection [ ] }
      if ( pd.prayers?.length ) this.prayers.set ( pd.prayers )
      if ( rd.reflections?.length ) this.reflections.set ( rd.reflections )
      if ( feastData ) this.feast.set ( feastData as FeastDay )
    } ).finally ( ( ) => this.loading.set ( false ) )
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

  public setReflectionFilter ( value: string ): void {
    this.reflectionFilter.set ( value )
  }

  public doReflectionsExist ( value: string ): boolean {
    if ( value === "all" ) return this.reflections ( ).length > 0
    return this.reflections ( ).some ( r => r.category === value )
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
