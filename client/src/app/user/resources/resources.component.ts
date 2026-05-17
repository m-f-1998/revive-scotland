import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { ContactComponent } from "../components/contact/contact.component"
import { SliderComponent } from "../components/slider/slider.component"
import { IconComponent } from "../../icon/icon.component"
import { ApiService } from "@revive/src/app/services/api.service"

export interface Prayer {
  id: string
  name: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  type: "devotional" | "intercessory" | "liturgical"
  text: string
  latin?: string
}

export interface Reflection {
  id: string
  title: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  youtubeId: string
}

export interface FeastDay {
  name: string
  colour: string
  date: string
  universalisUrl: string
}

export const DEFAULT_PRAYERS: Prayer[] = [
  {
    id: "our-father",
    name: "Our Father",
    category: "our-lord",
    type: "liturgical",
    text: "Our Father, who art in heaven,\nhallowed be thy name;\nthy kingdom come,\nthy will be done\non earth as it is in heaven.\nGive us this day our daily bread,\nand forgive us our trespasses,\nas we forgive those who trespass against us;\nand lead us not into temptation,\nbut deliver us from evil.\nAmen.",
    latin: "Pater noster, qui es in cælis,\nsanctificétur nomen tuum;\nadveniat regnum tuum;\nfiat voluntas tua,\nsicut in cælo et in terra.\nPanem nostrum quotidiánum da nobis hódie;\net dimítte nobis débita nostra,\nsicut et nos dimíttimus debitóribus nostris;\net ne nos indúcas in tentatiónem;\nsed líbera nos a malo.\nAmen."
  },
  {
    id: "hail-mary",
    name: "Hail Mary",
    category: "our-lady",
    type: "devotional",
    text: "Hail Mary, full of grace,\nthe Lord is with thee.\nBlessed art thou among women,\nand blessed is the fruit of thy womb, Jesus.\nHoly Mary, Mother of God,\npray for us sinners,\nnow and at the hour of our death.\nAmen.",
    latin: "Ave María, grátia plena,\nDóminus tecum.\nBenedicta tu in muliéribus,\net benedíctus fructus ventris tui, Iesus.\nSancta María, Mater Dei,\nora pro nobis peccatóribus,\nnunc et in hora mortis nostræ.\nAmen."
  },
  {
    id: "glory-be",
    name: "Glory Be",
    category: "our-lord",
    type: "liturgical",
    text: "Glory be to the Father,\nand to the Son,\nand to the Holy Spirit.\nAs it was in the beginning,\nis now, and ever shall be,\nworld without end.\nAmen.",
    latin: "Glória Patri,\net Fílio,\net Spirítui Sancto.\nSicut erat in princípio,\net nunc et semper,\net in sǽcula sæculórum.\nAmen."
  },
  {
    id: "hail-holy-queen",
    name: "Hail Holy Queen",
    category: "our-lady",
    type: "devotional",
    text: "Hail, Holy Queen, Mother of Mercy,\nhail our life, our sweetness and our hope.\nTo thee do we cry, poor banished children of Eve;\nto thee do we send up our sighs,\nmourning and weeping in this valley of tears.\nTurn then, most gracious advocate,\nthine eyes of mercy towards us;\nand after this our exile,\nshow unto us the blessed fruit of thy womb, Jesus.\nO clement, O loving, O sweet Virgin Mary.\n\nPray for us, O holy Mother of God,\nthat we may be made worthy of the promises of Christ.\nAmen.",
    latin: "Salve, Regína, mater misericordiæ,\nvita, dulcédo et spes nostra, salve.\nAd te clamámus, éxsules fílii Evæ,\nad te suspirámus, geméntes et flentes\nin hac lacrimárum valle.\nEia ergo, advocáta nostra,\nillos tuos misericordes óculos ad nos convérte;\net Iesum, benedíctum fructum ventris tui,\nnobis post hoc exsílium osténde.\nO clemens, o pia, o dulcis Virgo María.\n\nOra pro nobis, sancta Dei Génetrix,\nut digni efficiámur promissiónibus Christi.\nAmen."
  },
  {
    id: "memorare",
    name: "Memorare",
    category: "our-lady",
    type: "intercessory",
    text: "Remember, O most gracious Virgin Mary,\nthat never was it known\nthat anyone who fled to thy protection,\nimplored thy help,\nor sought thy intercession,\nwas left unaided.\nInspired by this confidence,\nI fly unto thee, O Virgin of virgins, my Mother;\nto thee do I come, before thee I stand,\nsinful and sorrowful.\nO Mother of the Word Incarnate,\ndespise not my petitions,\nbut in thy mercy hear and answer me.\nAmen."
  },
  {
    id: "guardian-angel",
    name: "Guardian Angel Prayer",
    category: "angels",
    type: "devotional",
    text: "Angel of God, my guardian dear,\nto whom God's love commits me here,\never this day be at my side,\nto light and guard, to rule and guide.\nAmen.",
    latin: "Ángele Dei,\nqui custos es mei,\nme, tibi commíssum pietáte supérna,\nhódie illúmina, custódi,\nrege et gubérna.\nAmen."
  },
  {
    id: "st-michael",
    name: "Prayer to St Michael",
    category: "angels",
    type: "intercessory",
    text: "Saint Michael the Archangel,\ndefend us in battle.\nBe our protection against the wickedness and snares of the devil.\nMay God rebuke him, we humbly pray;\nand do thou, O Prince of the Heavenly Host,\nby the power of God,\ncast into hell Satan and all evil spirits\nwho wander through the world seeking the ruin of souls.\nAmen."
  },
  {
    id: "act-of-contrition",
    name: "Act of Contrition",
    category: "our-lord",
    type: "devotional",
    text: "O my God, I am heartily sorry for having offended Thee,\nand I detest all my sins,\nbecause I dread the loss of heaven and the pains of hell;\nbut most of all because they offend Thee, my God,\nwho art all good and deserving of all my love.\nI firmly resolve, with the help of Thy grace,\nto confess my sins, to do penance,\nand to amend my life.\nAmen."
  },
  {
    id: "anima-christi",
    name: "Anima Christi",
    category: "our-lord",
    type: "devotional",
    text: "Soul of Christ, sanctify me.\nBody of Christ, save me.\nBlood of Christ, inebriate me.\nWater from the side of Christ, wash me.\nPassion of Christ, strengthen me.\nO Good Jesus, hear me.\nWithin thy wounds hide me.\nSuffer me not to be separated from thee.\nFrom the malicious enemy defend me.\nIn the hour of my death call me.\nAnd bid me come to thee,\nthat with thy saints I may praise thee\nfor ever and ever.\nAmen.",
    latin: "Anima Christi, sanctifica me.\nCorpus Christi, salva me.\nSanguis Christi, inébria me.\nAqua lateris Christi, lava me.\nPassio Christi, conforta me.\nO bone Iesu, exáudi me.\nIntra tua vúlnera abscónde me.\nNe permíttas me separári a te.\nAb hoste malígno defénde me.\nIn hora mortis meæ voca me.\nEt iube me veníre ad te,\nut cum Sanctis tuis laudem te\nin sǽcula sæculórum.\nAmen."
  },
  {
    id: "prayer-st-andrew",
    name: "Prayer to St Andrew",
    category: "martyrs",
    type: "intercessory",
    text: "O Glorious Saint Andrew,\npatron of Scotland and apostle of Christ,\nyou left all things to follow the Lord\nand brought others to know him.\nPray for Scotland and for all who seek the Lord,\nthat they too may hear his call,\nleave what holds them back,\nand follow him with whole hearts.\nAmen."
  }
]

const CATEGORY_ORDER = [ "our-lord", "our-lady", "martyrs", "angels" ] as const

const CATEGORY_LABELS: Record<string, string> = {
  "our-lord": "Our Lord",
  "our-lady": "Our Lady",
  "martyrs": "Martyrs",
  "angels": "Angels"
}

const TYPE_LABELS: Record<string, string> = {
  "devotional": "Devotional",
  "intercessory": "Intercessory",
  "liturgical": "Liturgical"
}

const COLOUR_MAP: Record<string, string> = {
  "White": "#FFFFFF",
  "Black": "#000000",
  "Purple": "#7C3AED",
  "Red": "#DC2626",
  "Green": "#16A34A",
  "Rose": "#EC4899",
  "Gold": "#B8962E",
  "Violet": "#7C3AED"
}

@Component ( {
  selector: "app-resources",
  imports: [ NavbarComponent, FooterComponent, ContactComponent, SliderComponent, IconComponent ],
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
  public selectedPrayerCategory: WritableSignal<string> = signal ( "our-lord" )

  public readonly typeLabels = TYPE_LABELS
  public readonly categoryLabels = CATEGORY_LABELS

  // Prayers grouped by category in the correct order, empty categories excluded
  public readonly categorisedPrayers = computed ( ( ) =>
    CATEGORY_ORDER
      .map ( cat => ( {
        key: cat,
        label: CATEGORY_LABELS [ cat ],
        prayers: this.prayers ( ).filter ( p => p.category === cat )
      } ) )
      .filter ( c => c.prayers.length > 0 )
  )

  // Prayers for the currently selected tab
  public readonly activePrayers = computed ( ( ) => {
    const groups = this.categorisedPrayers ( )
    const selected = this.selectedPrayerCategory ( )
    // If selected tab no longer has prayers, fall back to first available
    return groups.find ( g => g.key === selected ) ?? groups [ 0 ] ?? null
  } )

  public readonly activePrayerKey = computed ( ( ) => this.activePrayers ( )?.key ?? "" )

  public readonly filteredReflections = computed ( ( ) => {
    const cat = this.reflectionFilter ( )
    return this.reflections ( ).filter ( r => cat === "all" || r.category === cat )
  } )

  public readonly categoryKeys = Object.keys ( CATEGORY_LABELS )

  public readonly feastColourHex = computed ( ( ) => {
    const colour = this.feast ( )?.colour ?? "Green"
    return COLOUR_MAP [ colour ] ?? COLOUR_MAP [ "Green" ]
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

  public readonly slides = [
    {
      title: "Resources",
      content: "Deepen your faith with prayers, video reflections, and today's Mass from the Scottish liturgical calendar.",
      image: "gallery/kinloss/kinloss-13.jpg"
    }
  ]

  // Reactive dark mode signal — updates when OS preference changes
  private readonly darkMode: WritableSignal<boolean> = signal (
    window.matchMedia ( "(prefers-color-scheme: dark)" ).matches
  )

  private readonly apiSvc: ApiService = inject ( ApiService )

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
      this.prayers.set ( pd.prayers?.length ? pd.prayers : DEFAULT_PRAYERS )
      if ( rd.reflections?.length ) this.reflections.set ( rd.reflections )
      if ( feastData ) this.feast.set ( feastData as FeastDay )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public openPrayer ( prayer: Prayer ): void {
    this.selectedPrayer.set ( prayer )
    this.showLatin.set ( false )
    document.body.style.overflow = "hidden"
  }

  public closePrayer ( ): void {
    this.selectedPrayer.set ( null )
    document.body.style.overflow = ""
  }

  public setReflectionFilter ( value: string ): void { this.reflectionFilter.set ( value ) }

  public formatCategory ( value: string ): string {
    return CATEGORY_LABELS [ value ] ?? value
  }

  public formatType ( value: string ): string {
    return TYPE_LABELS [ value ] ?? value
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
