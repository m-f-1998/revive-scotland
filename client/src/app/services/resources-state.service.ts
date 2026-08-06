import { computed, inject, Service, signal, WritableSignal } from "@angular/core"
import { Prayer, Reflection, FeastDay, CategoryLabel, CategoryOrder, ColourMap } from "../user/liturgy/liturgy.interface"
import { ApiService } from "./api.service"

@Service ( )
export class ResourcesStateService {
  public readonly loading: WritableSignal<boolean> = signal ( true )
  public readonly prayers: WritableSignal<Prayer[]> = signal ( [ ] )
  public readonly reflections: WritableSignal<Reflection[]> = signal ( [ ] )
  public readonly feast: WritableSignal<FeastDay | null> = signal ( null )

  // Filters and Selections
  public readonly reflectionFilter: WritableSignal<string> = signal ( "all" )
  public readonly selectedPrayerCategory: WritableSignal<string> = signal ( "our-lord" )

  public readonly categorisedPrayers = computed ( ( ) =>
    CategoryOrder
      .map ( cat => ( {
        key: cat,
        label: CategoryLabel[cat],
        prayers: this.prayers ( ).filter ( p => p.category === cat )
      } ) )
      .filter ( c => c.prayers.length > 0 )
  )

  public readonly activePrayers = computed ( ( ) => {
    const groups = this.categorisedPrayers ( )
    const selected = this.selectedPrayerCategory ( )
    return groups.find ( g => g.key === selected ) ?? groups[0] ?? null
  } )

  public readonly activePrayerKey = computed ( ( ) => this.activePrayers ( )?.key ?? "" )

  public readonly filteredReflections = computed ( ( ) => {
    const cat = this.reflectionFilter ( )
    return this.reflections ( ).filter ( r => cat === "all" || r.category === cat )
  } )

  public readonly categoryKeys = computed ( ( ) =>
    this.categorisedPrayers ( ).map ( c => c.key ) as ( keyof typeof CategoryLabel )[]
  )

  public readonly feastColourHex = computed ( ( ) => {
    const colour = this.feast ( )?.colour ?? "Green"
    return ColourMap[colour] ?? ColourMap["Green"]
  } )

  // For white vestments, borders and text use near-black so the badge stands out
  public readonly feastAccentColour = computed ( ( ) =>
    this.feast ( )?.colour === "White" ? "#111827" : this.feastColourHex ( )
  )

  public readonly isNeutralVestment = computed ( ( ) => {
    const colour = this.feast ( )?.colour ?? ""
    return colour === "White" || colour === "Black"
  } )

  private readonly apiSvc = inject ( ApiService )

  public async loadInitialData ( ): Promise<void> {
    this.loading.set ( true )
    try {
      const [ prayerData, reflectionData, feastData ] = await Promise.all ( [
        this.apiSvc.get ( "/api/admin/prayers" ).catch ( ( ) => ( { prayers: [ ] } ) ),
        this.apiSvc.get ( "/api/admin/reflections" ).catch ( ( ) => ( { reflections: [ ] } ) ),
        this.apiSvc.get ( "/api/feast" ).catch ( ( ) => null )
      ] )

      const pd = prayerData as { prayers?: Prayer[] }
      const rd = reflectionData as { reflections?: Reflection[] }

      if ( pd.prayers?.length ) this.prayers.set ( pd.prayers )
      if ( rd.reflections?.length ) this.reflections.set ( rd.reflections )
      if ( feastData ) this.feast.set ( feastData as FeastDay )
    } finally {
      this.loading.set ( false )
    }
  }

  public setReflectionFilter ( value: string ): void {
    this.reflectionFilter.set ( value )
  }

  public setSelectedPrayerCategory ( value: string ): void {
    this.selectedPrayerCategory.set ( value )
  }

  public doReflectionsExist ( value: string ): boolean {
    if ( value === "all" ) return this.reflections ( ).length > 0
    return this.reflections ( ).some ( r => r.category === value )
  }
}