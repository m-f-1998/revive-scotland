import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal, computed } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { Event } from "../../interfaces/event.interface"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup, FormsModule } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { FormlyService } from "../../services/formly.service"
import { HttpErrorResponse, HttpHeaders } from "@angular/common/http"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { DatePipe, KeyValuePipe } from "@angular/common"
import { getEventFields } from "./config/event-editor.config"

interface SlideFormEntry {
  form: FormGroup
  model: WritableSignal<Record<string, unknown>>
  fields: FormlyFieldConfig [ ]
}

const DEFAULT_EVENTS_HEROES = [
  {
    id: "hero-1",
    title: "Upcoming Events",
    description: "Revive Scotland",
    url: "gallery/skye/skye-1.jpg"
  },
  {
    id: "hero-2",
    title: "Upcoming Events",
    description: "Revive Scotland",
    url: "gallery/skye/skye-3.jpg"
  }
]

export type EventTab = "slider" | "listings" | "registrations"

@Component ( {
  selector: "app-admin-event-editor",
  imports: [
    AdminNavbarComponent,
    IconComponent,
    FormlyForm,
    AdminFooterComponent,
    DatePipe,
    KeyValuePipe,
    FormsModule
  ],
  templateUrl: "./event-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public eventForm: WritableSignal<Array<{ form: FormGroup; model: Record<string, unknown>; fields: FormlyFieldConfig [ ] }>> = signal ( [ ] )
  public eventData: WritableSignal<{ events: Event[] }> = signal ( { events: [ ] } )
  public collapsedIndices: Set<number> = new Set ( )
  public eventsModified: WritableSignal<boolean> = signal ( false )

  public activeTab: WritableSignal<EventTab> = signal ( "slider" )
  public activeSlideIndex: WritableSignal<number> = signal ( 0 )

  public readonly tabs = [
    { id: "slider" as const, label: "Page Slider", icon: "image" as const },
    { id: "listings" as const, label: "Event Listings", icon: "calendar-days" as const },
    { id: "registrations" as const, label: "Registrations", icon: "users" as const }
  ]

  // Section state
  public saving: WritableSignal<Record<string, boolean>> = signal ( { } )
  public defaultSections: WritableSignal<Record<string, boolean>> = signal ( { } )
  public dirtyManual: WritableSignal<Record<string, boolean>> = signal ( { } )

  // Slider section state
  public sliderForms: WritableSignal<SlideFormEntry [ ]> = signal ( [ ] )

  // Registrations state
  public registrations: WritableSignal<Record<string, Array<Record<string, unknown>>>> = signal ( { } )
  public selectedRegEventId: WritableSignal<string> = signal ( "" )
  public regStatusFilter: WritableSignal<"all" | "completed" | "pending_payment"> = signal ( "all" )
  public regSearchQuery: WritableSignal<string> = signal ( "" )
  public loadingRegs: WritableSignal<boolean> = signal ( false )

  public filteredRegistrations = computed ( ( ) => {
    const eventId = this.selectedRegEventId ( )
    const regs = this.registrations ( ) [ eventId ] || [ ]
    const status = this.regStatusFilter ( )
    const query = this.regSearchQuery ( ).toLowerCase ( ).trim ( )

    return regs.filter ( reg => {
      // 1. Status Filter
      if ( status !== "all" && reg [ "status" ] !== status ) {
        return false
      }

      // 2. Search Filter
      if ( query ) {
        const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
        const stringifiedValues = Object.values ( formData ).map ( v => String ( v ).toLowerCase ( ) ).join ( " " )
        const creationDate = String ( reg [ "createdAt" ] || "" ).toLowerCase ( )
        const regStatus = String ( reg [ "status" ] || "" ).toLowerCase ( )
        return stringifiedValues.includes ( query ) || creationDate.includes ( query ) || regStatus.includes ( query )
      }

      return true
    } )
  } )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public get contactEvents ( ) {
    return this.eventData ( ).events.filter ( e => e.actionType === "contact" )
  }

  public ngOnInit ( ): void {
    Promise.all ( [
      this.loadEventData ( ),
      this.loadSlider ( )
    ] ).finally ( ( ) => this.loading.set ( false ) )
  }

  public setActiveTab ( tab: EventTab ): void {
    this.activeTab.set ( tab )
  }

  public isDefault ( key: string ): boolean {
    return this.defaultSections ( ) [ key ] === true
  }

  public isSaveDisabled ( key: string ): boolean {
    if ( !this.isDefault ( key ) ) return false
    return !this.dirtyManual ( ) [ key ]
  }

  public isSaving ( key: string ): boolean {
    return !!this.saving ( ) [ key ]
  }

  public toggleCollapsed ( index: number ): void {
    if ( this.collapsedIndices.has ( index ) ) {
      // Deleting from collapsedIndices means EXPANDING the card
      this.collapsedIndices.delete ( index )
      const model = this.eventForm ( ) [ index ]?.model
      if ( model && model [ "id" ] && model [ "actionType" ] === "contact" ) {
        this.loadRegistrations ( model [ "id" ] as string )
      }
    } else {
      // Adding to collapsedIndices means COLLAPSING the card
      this.collapsedIndices.add ( index )
    }
  }

  public addNewEvent ( ): void {
    const defaultModel = {
      id: "",
      title: "",
      description: "",
      location: "",
      startDate: new Date ( ),
      endDate: new Date ( ),
      startTime: "",
      endTime: "",
      actionType: "webpage" as const
    }
    this.eventsModified.set ( true )
    this.eventForm.set ( [
      ...this.eventForm ( ),
      {
        form: new FormGroup ( { } ),
        model: { ...defaultModel },
        fields: getEventFields ( this.formlySvc )
      }
    ] )
    this.eventData.set ( {
      events: [
        ...this.eventData ( ).events,
        { ...defaultModel }
      ]
    } )
  }

  public async saveEventData ( ) {
    if ( this.loading ( ) ) return

    const updatedEventData = {
      events: this.eventForm ( ).map ( ef => {
        return {
          id: ( ef.model [ "id" ] as string ) || `event-${Date.now ( )}-${Math.floor ( Math.random ( ) * 1000 )}`,
          title: ef.model [ "title" ] as string,
          description: ef.model [ "description" ] as string,
          location: ef.model?. [ "location" ] as string || "",
          imageUrl: ef.model [ "imageUrl" ] as string,
          startDate: ef.model [ "startDate" ] as Date,
          endDate: ef.model [ "endDate" ] as Date,
          startTime: ef.model [ "startTime" ] as string,
          endTime: ef.model [ "endTime" ] as string,
          actionType: ef.model [ "actionType" ] as "webpage" | "contact",
          webpageUrl: ef.model [ "webpageUrl" ] as string,
          contactFormFields: ef.model [ "contactFormFields" ] as FormlyFieldConfig [ ] || [ ],
          donationRequired: ef.model [ "donationRequired" ] as "required" | "none" | "optional" | undefined,
          donationDescription: ef.model [ "donationDescription" ] as string,
          donationPrice: ef.model [ "donationPrice" ] as number,
          stripeProductId: ef.model [ "stripeProductId" ] as string,
          stripePriceId: ef.model [ "stripePriceId" ] as string
        }
      } )
    }

    if ( updatedEventData.events.some ( e => !e.title ) ) {
      this.toastrSvc.error ( "Please ensure all events have a title before saving." )
      return
    }

    this.loading.set ( true )
    try {
      await this.apiSvc.post ( `/api/admin/events`, updatedEventData, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.eventData.set ( updatedEventData )
      this.eventsModified.set ( false )
      this.eventForm ( ).forEach ( ef => ef.form.markAsPristine ( ) )
      this.toastrSvc.success ( "Event data saved successfully!" )
    } catch ( e ) {
      if ( e instanceof HttpErrorResponse && e.error ) {
        this.toastrSvc.error ( `Failed to save event data: ${e.error}` )
      } else {
        this.toastrSvc.error ( "Failed to save event data." )
      }
    } finally {
      this.loading.set ( false )
    }
  }

  public async removeEvent ( id: string ) {
    this.loading.set ( true )
    this.eventData.update ( data => ( {
      ...data,
      events: data.events.filter ( ( e: Event ) => e.id !== id )
    } ) )
    try {
      await this.apiSvc.delete ( `/api/admin/events`, {
        id
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.toastrSvc.success ( "Event removed successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to remove event." )
    } finally {
      this.loading.set ( false )
    }
  }

  public someFormInvalid ( ): boolean {
    return this.eventForm ( ).some ( ef => ef.form.invalid )
  }

  public someFormDirty ( ): boolean {
    return this.eventsModified ( ) || this.eventForm ( ).some ( ef => ef.form.dirty )
  }

  public async loadRegistrations ( eventId: string ): Promise<void> {
    if ( this.registrations ( ) [ eventId ] ) return
    try {
      const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
      const res = await this.apiSvc.get ( `/api/admin/events/registrations`, { eventId }, new HttpHeaders ( {
        "Authorization": `Bearer ${token}`
      } ) )
      const data = res as { registrations: Array<Record<string, unknown>> }
      this.registrations.update ( r => ( { ...r, [ eventId ]: data.registrations } ) )
    } catch ( e ) {
      console.error ( "Failed to load registrations:", e )
      this.toastrSvc.error ( "Failed to load registrations." )
    }
  }

  public isEventFinished ( endDate: string | Date ): boolean {
    if ( !endDate ) return false
    const end = new Date ( endDate )
    return !isNaN ( end.getTime ( ) ) && end < new Date ( )
  }

  public getEventTimeoutText ( endDate: string | Date ): string {
    if ( !endDate ) return ""
    const end = new Date ( endDate )
    if ( isNaN ( end.getTime ( ) ) ) return ""
    const removalDate = new Date ( end.getTime ( ) + 21 * 24 * 60 * 60 * 1000 )
    const diffTime = removalDate.getTime ( ) - Date.now ( )
    const diffDays = Math.ceil ( diffTime / ( 1000 * 60 * 60 * 24 ) )
    if ( diffDays <= 0 ) return "Deleting soon..."
    return `Finished - Deletes in ${diffDays} ${diffDays === 1 ? "day" : "days"}`
  }

  public getFieldLabel ( event: Event, key: string | number | symbol ): string {
    if ( !event.contactFormFields || !Array.isArray ( event.contactFormFields ) ) {
      return key.toString ( )
    }
    const field = event.contactFormFields.find ( f => f.key === key )
    if ( field ) {
      return ( ( field.props?.label as string ) || ( field.templateOptions?.label as string ) || key ).toString ( )
    }
    return key.toString ( )
  }

  public copyDirectLink ( eventId: unknown ): void {
    if ( !eventId || typeof eventId !== "string" ) return
    const url = `${window.location.origin}/events?id=${eventId}`
    navigator.clipboard.writeText ( url ).then ( ( ) => {
      this.toastrSvc.success ( "Direct link copied to clipboard!" )
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to copy link." )
    } )
  }

  // Slider methods
  public addSliderHero ( ): void {
    if ( this.sliderForms ( ).length >= 3 ) return
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.sliderForms.update ( forms => [ ...forms, {
      form: new FormGroup ( { } ),
      model: signal<Record<string, unknown>> ( {
        id: `hero-${Date.now ( )}`,
        title: "",
        description: "",
        url: ""
      } ),
      fields: this.getSliderFields ( )
    } ] )
    this.activeSlideIndex.set ( this.sliderForms ( ).length - 1 )
  }

  public removeSliderHero ( index: number ): void {
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.sliderForms.update ( forms => forms.filter ( ( _, i ) => i !== index ) )
    const len = this.sliderForms ( ).length
    if ( this.activeSlideIndex ( ) >= len ) {
      this.activeSlideIndex.set ( Math.max ( 0, len - 1 ) )
    }
  }

  public onSliderHeroChange ( _index: number, entry: SlideFormEntry, value: Record<string, unknown> ): void {
    entry.model.set ( value )
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    if ( this.isDefault ( "slider" ) ) {
      this.defaultSections.update ( s => ( { ...s, slider: false } ) )
    }
  }

  public restoreSlider ( ): void {
    this.sliderForms.set ( this.buildSliderForms ( DEFAULT_EVENTS_HEROES ) )
    this.defaultSections.update ( s => ( { ...s, slider: true } ) )
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.activeSlideIndex.set ( 0 )
  }

  public getRegsForSelectedEvent ( ): Array<Record<string, unknown>> {
    const eventId = this.selectedRegEventId ( )
    return this.registrations ( ) [ eventId ] || [ ]
  }

  public onRegEventSelect ( eventId: string ): void {
    this.selectedRegEventId.set ( eventId )
    if ( eventId ) {
      this.loadingRegs.set ( true )
      this.loadRegistrations ( eventId ).finally ( ( ) => this.loadingRegs.set ( false ) )
    }
  }

  public refreshSelectedRegistrations ( ): void {
    const eventId = this.selectedRegEventId ( )
    if ( eventId ) {
      this.loadingRegs.set ( true )
      // Force reload by removing cache entry first
      this.registrations.update ( r => {
        const cloned = { ...r }
        delete cloned [ eventId ]
        return cloned
      } )
      this.loadRegistrations ( eventId ).finally ( ( ) => this.loadingRegs.set ( false ) )
    }
  }

  public getSelectedEventFieldLabel ( key: string | number | symbol ): string {
    const eventId = this.selectedRegEventId ( )
    const event = this.eventData ( ).events.find ( e => e.id === eventId )
    if ( !event ) return key.toString ( )
    return this.getFieldLabel ( event, key )
  }

  public async saveSlider ( ): Promise<void> {
    if ( this.sliderForms ( ).some ( sf => !sf.model ( ) [ "url" ] ) ) {
      this.toastrSvc.error ( "Please ensure all slides have an image." )
      return
    }
    this.saving.update ( s => ( { ...s, slider: true } ) )
    try {
      const heroes = this.sliderForms ( ).map ( sf => sf.model ( ) )
      await this.apiSvc.post ( "/api/admin/hero-editor/events", { heroes }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.defaultSections.update ( s => ( { ...s, slider: false } ) )
      this.dirtyManual.update ( s => ( { ...s, slider: false } ) )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.update ( s => ( { ...s, slider: false } ) )
    }
  }

  private async loadSlider ( ): Promise<void> {
    try {
      const res = await this.apiSvc.get ( "/api/admin/hero-editor/events" ) as { heroes?: typeof DEFAULT_EVENTS_HEROES }
      if ( res?.heroes?.length ) {
        this.sliderForms.set ( this.buildSliderForms ( res.heroes ) )
      } else {
        this.sliderForms.set ( this.buildSliderForms ( DEFAULT_EVENTS_HEROES ) )
        this.defaultSections.update ( s => ( { ...s, slider: true } ) )
      }
    } catch {
      this.sliderForms.set ( this.buildSliderForms ( DEFAULT_EVENTS_HEROES ) )
      this.defaultSections.update ( s => ( { ...s, slider: true } ) )
    }
  }

  private buildSliderForms ( slides: typeof DEFAULT_EVENTS_HEROES ): SlideFormEntry [ ] {
    return slides.map ( slide => ( {
      form: new FormGroup ( { } ),
      model: signal<Record<string, unknown>> ( { ...slide } ),
      fields: this.getSliderFields ( )
    } ) )
  }

  private getSliderFields ( ): FormlyFieldConfig [ ] {
    return [
      this.formlySvc.TextInput ( "title", { label: "Title", placeholder: "Enter slide title", required: true, maxLength: 100 } ),
      this.formlySvc.TextAreaInput ( "description", { label: "Text", placeholder: "Enter slide description", required: true, maxLength: 500, includeMaxDescription: true } ),
      this.formlySvc.ImagePickerInput ( "url", { label: "Background Media", required: true, attributes: { accept: "image/*,video/*" } } )
    ]
  }

  private async loadEventData ( ): Promise<void> {
    try {
      const events = ( await this.apiSvc.get ( "/api/admin/events" ) ) as { events: Event [ ] }
      this.eventData.set ( events )
      this.eventForm.set ( events.events.map ( event => ( {
        form: new FormGroup ( { } ),
        model: {
          ...event,
          startDate: event.startDate ? new Date ( event.startDate ) : null,
          endDate: event.endDate ? new Date ( event.endDate ) : null
        },
        fields: getEventFields ( this.formlySvc )
      } ) ) )
      events.events.forEach ( ( _, i ) => this.collapsedIndices.add ( i ) )
    } catch ( error ) {
      console.error ( "Error loading event data:", error )
    }
  }
}
