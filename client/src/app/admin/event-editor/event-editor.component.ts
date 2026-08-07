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
import { addDays } from "date-fns"
import { ModalService } from "../../services/modal.service"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"

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
  public regStatusFilter: WritableSignal<"all" | "completed" | "awaiting_payment" | "unpaid_optional" | "waitlist"> = signal ( "all" )
  public regSearchQuery: WritableSignal<string> = signal ( "" )
  public loadingRegs: WritableSignal<boolean> = signal ( false )
  public deletingRegIds: WritableSignal<Set<string>> = signal ( new Set ( ) )

  public getSelectedEvent = computed ( ( ) => {
    const eventId = this.selectedRegEventId ( )
    return this.eventData ( ).events.find ( e => e.id === eventId )
  } )

  public filteredRegistrations = computed ( ( ) => {
    const eventId = this.selectedRegEventId ( )
    const regs = this.registrations ( ) [ eventId ] || [ ]
    const status = this.regStatusFilter ( )
    const query = this.regSearchQuery ( ).toLowerCase ( ).trim ( )

    return regs.filter ( reg => {
      if ( status === "completed" ) {
        if ( reg [ "kind" ] === "draft" || reg [ "status" ] !== "completed" ) return false
      } else if ( status === "awaiting_payment" ) {
        if ( reg [ "kind" ] !== "draft" && reg [ "status" ] !== "awaiting_payment" ) return false
      } else if ( status === "unpaid_optional" ) {
        if ( reg [ "kind" ] === "draft" || reg [ "status" ] !== "completed" || reg [ "paymentIntent" ] ) return false
      } else if ( status === "waitlist" ) {
        if ( reg [ "status" ] !== "waitlist" ) return false
      }

      if ( query ) {
        const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
        const stringifiedValues = Object.values ( formData ).map ( v => String ( v ).toLowerCase ( ) ).join ( " " )
        const email = String ( reg [ "email" ] || "" ).toLowerCase ( )
        const name = String ( reg [ "name" ] || "" ).toLowerCase ( )
        const creationDate = String ( reg [ "createdAt" ] || "" ).toLowerCase ( )
        const regStatus = String ( reg [ "status" ] || "" ).toLowerCase ( )
        return stringifiedValues.includes ( query )
          || email.includes ( query )
          || name.includes ( query )
          || creationDate.includes ( query )
          || regStatus.includes ( query )
      }

      return true
    } )
  } )

  public expandedRegIds: Set<string> = new Set ( )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly modalSvc: ModalService = inject ( ModalService )

  public get formEvents ( ) {
    return this.eventData ( ).events.filter ( e => e.actionType === "form" )
  }

  public getSummaryDetail ( formData: unknown, keys: string[] ): string {
    if ( !formData || typeof formData !== "object" ) return "—"
    const data = formData as Record<string, unknown>
    for ( const key of keys ) {
      for ( const dataKey of Object.keys ( data ) ) {
        if ( dataKey.toLowerCase ( ) === key.toLowerCase ( ) && data [ dataKey ] ) {
          return String ( data [ dataKey ] )
        }
      }
    }
    return "—"
  }

  public printRegistrations ( ): void {
    window.print ( )
  }

  public toggleRegExpanded ( id: string ): void {
    if ( this.expandedRegIds.has ( id ) ) {
      this.expandedRegIds.delete ( id )
    } else {
      this.expandedRegIds.add ( id )
    }
  }

  public isCoreRegField ( key: string | number | symbol ): boolean {
    const k = String ( key ).toLowerCase ( )
    return [ "name", "email", "phone", "tel", "firstname", "first name" ].includes ( k )
      || k === "optindonation"
      || k === "customdonationamount"
  }

  public parseFloat ( val: unknown ): number {
    if ( val == null ) return 0
    const parsed = parseFloat ( String ( val ) )
    return isNaN ( parsed ) ? 0 : parsed
  }

  public ngOnInit ( ): void {
    Promise.all ( [
      this.loadEventData ( ),
      this.loadSlider ( )
    ] ).finally ( ( ) => this.loading.set ( false ) )
  }

  public onEventFormChange ( index: number, value: Record<string, unknown> ): void {
    this.eventsModified.set ( true )
    this.eventForm.update ( forms => {
      const cloned = [ ...forms ]
      if ( cloned [ index ] ) {
        cloned [ index ] = {
          ...cloned [ index ],
          model: { ...value }
        }
      }
      return cloned
    } )
  }

  public setActiveTab ( tab: EventTab ): void {
    this.expandedRegIds.clear ( )
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
      if ( model && model [ "id" ] && ( model [ "actionType" ] === "form" || model [ "actionType" ] === "contact" ) ) {
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
      endDate: addDays ( new Date ( ), 1 ),
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
        fields: getEventFields ( this.formlySvc, defaultModel )
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
          actionType: ( ef.model [ "actionType" ] === "form" || ef.model [ "actionType" ] === "contact" ? "form" : "webpage" ) as "webpage" | "form",
          webpageUrl: ef.model [ "webpageUrl" ] as string,
          contactFormFields: ef.model [ "contactFormFields" ] as FormlyFieldConfig [ ] || [ ],
          donationRequired: ef.model [ "donationRequired" ] as "required" | "none" | "optional" | undefined,
          donationDescription: ef.model [ "donationDescription" ] as string,
          donationPrice: ef.model [ "donationPrice" ] != null ? Math.round ( ( ef.model [ "donationPrice" ] as number ) * 100 ) : undefined,
          stripeProductId: ef.model [ "stripeProductId" ] as string,
          stripePriceId: ef.model [ "stripePriceId" ] as string,
          maxAttendees: ef.model [ "maxAttendees" ] != null && ef.model [ "maxAttendees" ] !== ""
            ? Math.floor ( Number ( ef.model [ "maxAttendees" ] ) )
            : undefined,
          waitlistEnabled: ef.model [ "waitlistEnabled" ] === true
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

  public async removeEvent ( index: number ) {
    const forms = this.eventForm ( )
    const model = forms [ index ]?.model
    if ( !model ) return

    const id = String ( model [ "id" ] || "" ).trim ( )

    const dropLocal = ( ) => {
      this.eventForm.set ( forms.filter ( ( _, i ) => i !== index ) )
      this.eventData.update ( data => ( {
        ...data,
        events: data.events.filter ( ( _, i ) => i !== index )
      } ) )
      this.eventsModified.set ( true )

      const nextCollapsed = new Set<number> ( )
      for ( const collapsed of this.collapsedIndices ) {
        if ( collapsed < index ) nextCollapsed.add ( collapsed )
        else if ( collapsed > index ) nextCollapsed.add ( collapsed - 1 )
      }
      this.collapsedIndices.clear ( )
      nextCollapsed.forEach ( i => this.collapsedIndices.add ( i ) )
    }

    if ( !id ) {
      dropLocal ( )
      this.toastrSvc.success ( "Unsaved event discarded." )
      return
    }

    if ( !confirm (
      "Delete this event?\n\nAny paid registrations will be fully refunded via Stripe, and unpaid invoices/drafts will be voided."
    ) ) {
      return
    }

    this.loading.set ( true )
    try {
      await this.apiSvc.delete ( `/api/admin/events`, {
        id
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      dropLocal ( )
      this.toastrSvc.success ( "Event removed. Paid registrations were refunded where applicable." )
    } catch ( err ) {
      const msg = err instanceof HttpErrorResponse
        ? ( typeof err.error === "object" && err.error?. [ "error" ]
          ? String ( err.error [ "error" ] )
          : "Failed to remove event from the server." )
        : "Failed to remove event from the server."
      this.toastrSvc.error ( msg )
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

  public isEventFinished ( endDate: unknown ): boolean {
    if ( !endDate ) return false
    const end = new Date ( String ( endDate ) )
    return !isNaN ( end.getTime ( ) ) && end < new Date ( )
  }

  public getEventTimeoutText ( endDate: string | Date ): string {
    if ( !endDate ) return ""
    const end = new Date ( endDate )
    if ( isNaN ( end.getTime ( ) ) ) return ""
    const hideDate = new Date ( end.getTime ( ) + 21 * 24 * 60 * 60 * 1000 )
    const diffTime = hideDate.getTime ( ) - Date.now ( )
    const diffDays = Math.ceil ( diffTime / ( 1000 * 60 * 60 * 24 ) )
    if ( diffDays <= 0 ) return "Hidden from public site"
    return `Finished — hidden from public in ${diffDays} ${diffDays === 1 ? "day" : "days"}`
  }

  public regStatusLabel ( reg: Record<string, unknown> ): string {
    if ( reg [ "kind" ] === "draft" || reg [ "status" ] === "awaiting_payment" ) return "Awaiting payment"
    if ( reg [ "status" ] === "waitlist" ) return "Waitlist"
    if ( reg [ "status" ] === "completed" && !reg [ "paymentIntent" ] ) return "Registered"
    if ( reg [ "status" ] === "completed" ) return "Paid"
    return String ( reg [ "status" ] || "—" )
  }

  public async toggleAttendance ( reg: Record<string, unknown> ): Promise<void> {
    if ( reg [ "kind" ] === "draft" || this.isAwaitingPayment ( reg ) ) return
    const id = String ( reg [ "id" ] || "" )
    if ( !id ) return
    const next = !reg [ "attended" ]
    try {
      const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
      await this.apiSvc.patch (
        `/api/admin/events/registrations/${id}/attendance`,
        { attended: next },
        new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
      )
      const eventId = this.selectedRegEventId ( )
      this.registrations.update ( r => ( {
        ...r,
        [ eventId ]: ( r [ eventId ] || [ ] ).map ( item =>
          item [ "id" ] === id ? { ...item, attended: next } : item
        )
      } ) )
    } catch ( e ) {
      console.error ( e )
      this.toastrSvc.error ( "Failed to update attendance." )
    }
  }

  public isAwaitingPayment ( reg: Record<string, unknown> ): boolean {
    return reg [ "kind" ] === "draft" || reg [ "status" ] === "awaiting_payment"
  }

  public exportRegistrationsCsv ( ): void {
    const rows = this.filteredRegistrations ( )
    if ( !rows.length ) {
      this.toastrSvc.info ( "Nothing to export for the current filter." )
      return
    }

    const event = this.getSelectedEvent ( )
    const headers = [ "Date", "Kind", "Status", "Name", "Email", "Phone", "Amount", "PaymentIntent", "Details" ]
    const escape = ( v: unknown ) => {
      const s = v == null ? "" : String ( v )
      return `"${s.replace ( /"/g, "\"\"" )}"`
    }

    const lines = [ headers.join ( "," ) ]
    for ( const reg of rows ) {
      const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
      const name = reg [ "name" ]
        || this.getSummaryDetail ( formData, [ "name", "Name", "firstName", "First Name" ] )
      const email = reg [ "email" ]
        || this.getSummaryDetail ( formData, [ "email", "Email" ] )
      const phone = this.getSummaryDetail ( formData, [ "phone", "Phone", "tel" ] )
      const amountPence = reg [ "amountPence" ] != null
        ? Number ( reg [ "amountPence" ] )
        : ( event?.donationPrice ?? "" )
      const amount = typeof amountPence === "number" && Number.isFinite ( amountPence )
        ? ( amountPence / 100 ).toFixed ( 2 )
        : ""
      const details = Object.entries ( formData )
        .filter ( ( [ k ] ) => !this.isCoreRegField ( k ) )
        .map ( ( [ k, v ] ) => `${this.getSelectedEventFieldLabel ( k )}=${v}` )
        .join ( "; " )

      lines.push ( [
        escape ( reg [ "createdAt" ] ),
        escape ( reg [ "kind" ] === "draft" ? "draft" : "registration" ),
        escape ( this.regStatusLabel ( reg ) ),
        escape ( name === "—" ? "" : name ),
        escape ( email === "—" ? "" : email ),
        escape ( phone === "—" ? "" : phone ),
        escape ( amount ),
        escape ( reg [ "paymentIntent" ] || "" ),
        escape ( details )
      ].join ( "," ) )
    }

    const blob = new Blob ( [ lines.join ( "\n" ) ], { type: "text/csv;charset=utf-8" } )
    const url = URL.createObjectURL ( blob )
    const a = document.createElement ( "a" )
    a.href = url
    a.download = `registrations-${this.selectedRegEventId ( ) || "event"}-${new Date ( ).toISOString ( ).slice ( 0, 10 )}.csv`
    a.click ( )
    URL.revokeObjectURL ( url )
    this.toastrSvc.success ( "CSV exported." )
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
    this.expandedRegIds.clear ( )
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

  public async generatePaymentLink ( reg: Record<string, unknown> ): Promise<void> {
    const event = this.getSelectedEvent ( )
    if ( !event ) return

    const modalRef = this.modalSvc.open ( InputDialogComponent, { centered: true } )
    modalRef.setInput ( "title", "Generate Donation Link" )
    modalRef.setInput ( "body", "Enter the custom donation amount for this user." )
    modalRef.setInput ( "confirmText", "Generate Link" )
    modalRef.setInput ( "fields", [
      this.formlySvc.TextInput ( "amount", {
        label: "Amount (£)",
        type: "number",
        placeholder: "e.g., 20.00",
        required: true,
        attributes: {
          min: "0.50",
          step: "0.01"
        }
      } )
    ] )

    try {
      const result = await modalRef.result as { amount: string }
      if ( !result.amount ) return

      const amountPence = Math.round ( parseFloat ( result.amount ) * 100 )

      this.toastrSvc.info ( "Generating Stripe Payment Link..." )
      const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
      const response = await this.apiSvc.post (
        `/api/admin/events/registrations/${reg["id"]}/pay-link`,
        { amountPence, eventId: event.id, eventTitle: event.title },
        new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
      ) as { url: string }

      if ( response.url ) {
        await navigator.clipboard.writeText ( response.url )
        this.toastrSvc.success ( "Payment Link generated and copied to clipboard!", "Success" )
      }
    } catch ( e ) {
      if ( e ) { // Meaning it wasn't just a dismiss
        this.toastrSvc.error ( "Failed to generate payment link." )
        console.error ( e )
      }
    }
  }

  public async deleteRegistration ( reg: Record<string, unknown> ): Promise<void> {
    const id = String ( reg [ "id" ] || "" )
    if ( !id || this.deletingRegIds ( ).has ( id ) ) return

    const isDraft = reg [ "kind" ] === "draft"
    const hasPayment = !!reg [ "paymentIntent" ]
    const name = String ( reg [ "name" ] || "" )
      || this.getSummaryDetail ( reg [ "formData" ], [ "name", "Name", "firstName" ] )
    const email = String ( reg [ "email" ] || "" )
      || this.getSummaryDetail ( reg [ "formData" ], [ "email", "Email" ] )
    const who = [ name && name !== "—" ? name : "", email && email !== "—" ? email : "" ]
      .filter ( Boolean ).join ( " · " ) || ( isDraft ? "this checkout draft" : "this registration" )

    const confirmed = window.confirm (
      isDraft
        ? `Remove unpaid checkout for ${who}?\n\nAny open Stripe invoice or Checkout session will be voided/expired.`
        : hasPayment
          ? `Refund payment for ${who}?\n\nThe Stripe payment will be fully refunded and the registration removed.`
          : `Delete ${who}?\n\nThis cannot be undone.`
    )
    if ( !confirmed ) return

    this.deletingRegIds.update ( s => new Set ( s ).add ( id ) )
    const eventId = this.selectedRegEventId ( )

    try {
      const path = isDraft
        ? `/api/admin/events/checkout-drafts/${id}`
        : `/api/admin/events/registrations/${id}`
      const res = await this.apiSvc.delete (
        path,
        { },
        new HttpHeaders ( {
          "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
        } )
      ) as { message?: string; refunded?: boolean; invoiceVoided?: boolean }

      this.registrations.update ( r => ( {
        ...r,
        [ eventId ]: ( r [ eventId ] || [ ] ).filter ( item => item [ "id" ] !== id )
      } ) )

      if ( isDraft ) {
        this.toastrSvc.success ( "Checkout draft removed." )
      } else if ( res.refunded ) {
        this.toastrSvc.success ( "Payment refunded and registration removed." )
      } else if ( res.invoiceVoided ) {
        this.toastrSvc.success ( "Open invoice voided and registration removed." )
      } else {
        this.toastrSvc.success ( "Registration deleted." )
      }
    } catch ( e ) {
      console.error ( "Failed to delete registration:", e )
      const msg = e && typeof e === "object" && "error" in e
        ? ( ( e as { error?: { error?: string } | string } ).error )
        : undefined
      const text = typeof msg === "string" ? msg : ( msg && typeof msg === "object" ? msg.error : undefined )
      this.toastrSvc.error ( text || "Failed to delete registration." )
    } finally {
      this.deletingRegIds.update ( s => {
        const next = new Set ( s )
        next.delete ( id )
        return next
      } )
    }
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
      this.formlySvc.TextInput ( "title", {
        label: "Title",
        placeholder: "Enter slide title",
        required: true,
        maxLength: 100
      } ),
      this.formlySvc.TextAreaInput ( "description", {
        label: "Text",
        placeholder: "Enter slide description",
        required: true,
        maxLength: 500,
        includeMaxDescription: true
      } ),
      this.formlySvc.ImagePickerInput ( "url", {
        label: "Background Media",
        required: true,
        attributes: {
          accept: "image/*,video/*"
        }
      } )
    ]
  }

  private async loadEventData ( ): Promise<void> {
    try {
      const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
      const events = ( await this.apiSvc.get (
        "/api/admin/events",
        { },
        new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
      ) ) as { events: Event [ ] }
      this.eventData.set ( events )
      this.eventForm.set ( events.events.map ( event => ( {
        form: new FormGroup ( { } ),
        model: {
          ...event,
          actionType: event.actionType === "form" || ( event.actionType as string ) === "contact" ? "form" : "webpage",
          startDate: event.startDate ? new Date ( event.startDate ) : null,
          endDate: event.endDate ? new Date ( event.endDate ) : null,
          donationPrice: event.donationPrice != null ? event.donationPrice / 100 : undefined
        },
        fields: getEventFields ( this.formlySvc, event as unknown as Record<string, unknown> )
      } ) ) )
      events.events.forEach ( ( _, i ) => this.collapsedIndices.add ( i ) )
    } catch ( error ) {
      console.error ( "Error loading event data:", error )
    }
  }
}
