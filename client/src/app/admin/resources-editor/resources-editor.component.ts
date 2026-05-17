import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { FormsModule } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"
import { DEFAULT_PRAYERS } from "../../user/resources/resources.component"

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
