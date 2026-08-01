import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { FormsModule } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"

interface Prayer {
  id: string
  name: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  type: "devotional" | "intercessory" | "liturgical"
  text: string
  latin?: string
}

interface Reflection {
  id: string
  title: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  youtubeId: string
}

const CATEGORIES: { value: string; label: string } [ ] = [
  { value: "our-lady", label: "Our Lady" },
  { value: "our-lord", label: "Our Lord" },
  { value: "angels", label: "Angels" },
  { value: "martyrs", label: "Martyrs" }
]

const PRAYER_TYPES: { value: string; label: string } [ ] = [
  { value: "devotional", label: "Devotional" },
  { value: "intercessory", label: "Intercessory" },
  { value: "liturgical", label: "Liturgical" }
]

export const DEFAULT_PRAYERS: Prayer [ ] = [
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

const generateId = ( ): string => Math.random ( ).toString ( 36 ).slice ( 2, 10 )

@Component ( {
  selector: "app-admin-resources-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, FormsModule ],
  templateUrl: "./resources-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ResourcesEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public savingPrayers: WritableSignal<boolean> = signal ( false )
  public savingReflections: WritableSignal<boolean> = signal ( false )

  public prayers: WritableSignal<Prayer [ ]> = signal ( [ ] )
  public reflections: WritableSignal<Reflection [ ]> = signal ( [ ] )

  public expandedPrayer: WritableSignal<number | null> = signal ( null )
  public expandedReflection: WritableSignal<number | null> = signal ( null )
  public prayersSectionCollapsed: WritableSignal<boolean> = signal ( false )
  public reflectionsSectionCollapsed: WritableSignal<boolean> = signal ( false )

  public readonly categories = CATEGORIES
  public readonly prayerTypes = PRAYER_TYPES

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    Promise.all ( [
      this.apiSvc.get ( "/api/admin/prayers" ).catch ( ( ) => ( { prayers: [ ] } ) ),
      this.apiSvc.get ( "/api/admin/reflections" ).catch ( ( ) => ( { reflections: [ ] } ) )
    ] ).then ( ( [ prayerData, reflectionData ] ) => {
      const pd = prayerData as { prayers?: Prayer [ ] }
      const rd = reflectionData as { reflections?: Reflection [ ] }
      this.prayers.set ( pd.prayers ?? [ ] )
      this.reflections.set ( rd.reflections ?? [ ] )
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to load resources." )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  // ── Prayers ────────────────────────────────────────────

  public addPrayer ( ): void {
    this.prayers.update ( p => [ ...p, { id: generateId ( ), name: "", category: "our-lord", type: "devotional", text: "" } ] )
    this.expandedPrayer.set ( this.prayers ( ).length - 1 )
    this.prayersSectionCollapsed.set ( false )
  }

  public removePrayer ( index: number ): void {
    this.prayers.update ( p => p.filter ( ( _, i ) => i !== index ) )
    if ( this.expandedPrayer ( ) === index ) this.expandedPrayer.set ( null )
  }

  public movePrayerUp ( index: number ): void {
    if ( index === 0 ) return
    this.prayers.update ( p => {
      const c = [ ...p ]
      ;[ c [ index - 1 ], c [ index ] ] = [ c [ index ], c [ index - 1 ] ]
      return c
    } )
  }

  public movePrayerDown ( index: number ): void {
    if ( index >= this.prayers ( ).length - 1 ) return
    this.prayers.update ( p => {
      const c = [ ...p ]
      ;[ c [ index ], c [ index + 1 ] ] = [ c [ index + 1 ], c [ index ] ]
      return c
    } )
  }

  public updatePrayer ( index: number, field: keyof Prayer, value: string ): void {
    this.prayers.update ( p => p.map ( ( item, i ) => i === index ? { ...item, [ field ]: value } : item ) )
  }

  public togglePrayer ( index: number ): void {
    this.expandedPrayer.set ( this.expandedPrayer ( ) === index ? null : index )
  }

  public restoreDefaultPrayers ( ): void {
    this.prayers.set ( [ ...DEFAULT_PRAYERS ] )
    this.expandedPrayer.set ( null )
    this.prayersSectionCollapsed.set ( false )
  }

  public prayersSomeEmpty ( ): boolean {
    return this.prayers ( ).some ( p => !p.name.trim ( ) || !p.text.trim ( ) )
  }

  public async savePrayers ( ): Promise<void> {
    if ( this.prayersSomeEmpty ( ) ) {
      this.toastrSvc.error ( "All prayers need a name and text before saving." )
      return
    }
    this.savingPrayers.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/prayers", { prayers: this.prayers ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Prayers saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save prayers." )
    } finally {
      this.savingPrayers.set ( false )
    }
  }

  // ── Reflections ─────────────────────────────────────────

  public addReflection ( ): void {
    this.reflections.update ( r => [ ...r, { id: generateId ( ), title: "", category: "our-lord", youtubeId: "" } ] )
    this.expandedReflection.set ( this.reflections ( ).length - 1 )
    this.reflectionsSectionCollapsed.set ( false )
  }

  public removeReflection ( index: number ): void {
    this.reflections.update ( r => r.filter ( ( _, i ) => i !== index ) )
    if ( this.expandedReflection ( ) === index ) this.expandedReflection.set ( null )
  }

  public moveReflectionUp ( index: number ): void {
    if ( index === 0 ) return
    this.reflections.update ( r => {
      const c = [ ...r ]
      ;[ c [ index - 1 ], c [ index ] ] = [ c [ index ], c [ index - 1 ] ]
      return c
    } )
  }

  public moveReflectionDown ( index: number ): void {
    if ( index >= this.reflections ( ).length - 1 ) return
    this.reflections.update ( r => {
      const c = [ ...r ]
      ;[ c [ index ], c [ index + 1 ] ] = [ c [ index + 1 ], c [ index ] ]
      return c
    } )
  }

  public updateReflection ( index: number, field: keyof Reflection, value: string ): void {
    this.reflections.update ( r => r.map ( ( item, i ) => i === index ? { ...item, [ field ]: value } : item ) )
  }

  public toggleReflection ( index: number ): void {
    this.expandedReflection.set ( this.expandedReflection ( ) === index ? null : index )
  }

  public reflectionsSomeEmpty ( ): boolean {
    return this.reflections ( ).some ( r => !r.title.trim ( ) || !r.youtubeId.trim ( ) )
  }

  public async saveReflections ( ): Promise<void> {
    if ( this.reflectionsSomeEmpty ( ) ) {
      this.toastrSvc.error ( "All reflections need a title and YouTube ID before saving." )
      return
    }
    this.savingReflections.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/reflections", { reflections: this.reflections ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Reflections saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save reflections." )
    } finally {
      this.savingReflections.set ( false )
    }
  }
}
