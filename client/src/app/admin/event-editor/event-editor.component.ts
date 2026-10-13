import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, WritableSignal, computed } from "@angular/core"
import { takeUntilDestroyed } from "@angular/core/rxjs-interop"
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
import { DatePipe } from "@angular/common"
import { dayAfterStart, endDateSyncHooks, getDefaultRegistrationFields, getEventFields, syncEventEndDate } from "./config/event-editor.config"
import { addDays } from "date-fns"
import { ModalService } from "../../services/modal.service"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { QrDownloadComponent } from "../../shared/qr-download/qr-download.component"
import { EmailGravatarComponent } from "../../shared/email-gravatar/email-gravatar.component"
import { OrganizationService } from "../../services/organization.service"
import { AdminOrganization } from "../../interfaces/organization.interface"

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

export type RegStatusTone =
  | "waitlist"
  | "checkout"
  | "confirmed"
  | "paid"
  | "donation-unpaid"
  | "no-donation"
  | "unknown"

export type RegManagerFilter =
  | "all"
  | "confirmed"
  | "checkout"
  | "waitlist"
  | "paid"
  | "donation_due"
  | "checked_in"

export type RegFilterGroup = "place" | "money" | "door"

export type RegManagerSort = "newest" | "oldest" | "name_az"

@Component ( {
  selector: "app-admin-event-editor",
  imports: [
    AdminNavbarComponent,
    IconComponent,
    FormlyForm,
    AdminFooterComponent,
    DatePipe,
    FormsModule,
    QrDownloadComponent,
    EmailGravatarComponent
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
  public listingsSaveAttempted: WritableSignal<boolean> = signal ( false )
  public showPastEvents: WritableSignal<boolean> = signal ( false )

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
  public regManagerFilter: WritableSignal<RegManagerFilter> = signal ( "all" )
  public regSearchQuery: WritableSignal<string> = signal ( "" )
  public regSort: WritableSignal<RegManagerSort> = signal ( "newest" )

  public readonly regManagerFilterDefs: Array<{
    id: RegManagerFilter
    label: string
    group: RegFilterGroup
    donationOnly?: boolean
  }> = [
    { id: "all", label: "All", group: "place" },
    { id: "confirmed", label: "Registered", group: "place" },
    { id: "checkout", label: "Payment not finished", group: "place" },
    { id: "waitlist", label: "Waitlist", group: "place" },
    { id: "paid", label: "Paid", group: "money", donationOnly: true },
    { id: "donation_due", label: "Donation unpaid", group: "money", donationOnly: true },
    { id: "checked_in", label: "Checked in", group: "door" }
  ]
  public loadingRegs: WritableSignal<boolean> = signal ( false )
  public deletingRegIds: WritableSignal<Set<string>> = signal ( new Set ( ) )
  public publishingOrganizationId: WritableSignal<string> = signal ( "" )
  public adminOrganizations: WritableSignal<AdminOrganization [ ]> = signal ( [ ] )
  public registrationCounts: WritableSignal<Record<string, number>> = signal ( { } )
  public stripeLivemode: WritableSignal<boolean> = signal ( true )
  public expandedRegIds: WritableSignal<Set<string>> = signal ( new Set ( ) )

  public getSelectedEvent = computed ( ( ) => {
    const eventId = this.selectedRegEventId ( )
    return this.eventData ( ).events.find ( e => e.id === eventId )
  } )

  public regFilterCounts = computed ( ( ) => {
    const regs = this.regsForSelectedEvent ( )
    const counts = { } as Record<RegManagerFilter, number>
    for ( const def of this.regManagerFilterDefs ) {
      counts [ def.id ] = def.id === "all"
        ? regs.length
        : regs.filter ( reg => this.regMatchesManagerFilter ( reg, def.id ) ).length
    }
    return counts
  } )

  public regFiltersActive = computed ( ( ) => {
    return this.regManagerFilter ( ) !== "all"
      || !!this.regSearchQuery ( ).trim ( )
  } )

  public filteredRegistrations = computed ( ( ) => {
    const regs = this.regsForSelectedEvent ( )
    const filter = this.regManagerFilter ( )
    const query = this.regSearchQuery ( ).toLowerCase ( ).trim ( )
    const sort = this.regSort ( )

    let rows = regs.filter ( reg => {
      if ( filter !== "all" && !this.regMatchesManagerFilter ( reg, filter ) ) {
        return false
      }
      return !query || this.regMatchesSearchQuery ( reg, query )
    } )

    rows = [ ...rows ].sort ( ( a, b ) => this.compareRegsForSort ( a, b, sort ) )
    return rows
  } )

  public listingIndices = computed ( ( ) => {
    const events = this.eventData ( ).events
    return events
      .map ( ( _, index ) => index )
      .filter ( index => this.showPastEvents ( ) || !this.isEventFinished ( events [ index ]?.endDate ) )
  } )

  public regsForSelectedEvent = computed ( ( ) => {
    const eventId = this.selectedRegEventId ( )
    return this.registrations ( ) [ eventId ] || [ ]
  } )

  public selectedEventHasDonationFilters = computed ( ( ) => {
    const mode = this.getSelectedEvent ( )?.donationRequired || "none"
    return mode !== "none"
  } )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly destroyRef: DestroyRef = inject ( DestroyRef )
  private readonly attachedEventForms = new WeakSet<FormGroup> ( )
  private readonly orgSvc: OrganizationService = inject ( OrganizationService )

  public get formEvents ( ) {
    return this.eventData ( ).events.filter ( e => e.actionType === "form" )
  }

  public visibleRegManagerFilterDefs ( group: RegFilterGroup ) {
    const donation = this.selectedEventHasDonationFilters ( )
    const counts = this.regFilterCounts ( )
    const selected = this.regManagerFilter ( )
    return this.regManagerFilterDefs.filter ( def => {
      if ( def.group !== group ) return false
      if ( def.donationOnly && !donation ) return false
      if ( def.id === "all" || def.id === selected ) return true
      return ( counts [ def.id ] || 0 ) > 0
    } )
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

  public isRegExpanded ( id: string ): boolean {
    return this.expandedRegIds ( ).has ( id )
  }

  public toggleRegExpanded ( id: string ): void {
    this.expandedRegIds.update ( set => {
      const next = new Set ( set )
      if ( next.has ( id ) ) {
        next.delete ( id )
      } else {
        next.add ( id )
      }
      return next
    } )
  }

  public getRegExtraFields ( reg: Record<string, unknown> ): Array<{ key: string; value: unknown }> {
    const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
    return Object.entries ( formData )
      .filter ( ( [ k ] ) => !this.isCoreRegField ( k ) )
      .map ( ( [ key, value ] ) => ( { key, value } ) )
  }

  public formatRegFieldValue ( key: string | number | symbol, value: unknown ): string {
    if ( value === null || value === undefined || value === "" ) return "—"

    const event = this.getSelectedEvent ( )
    const fieldKey = String ( key )
    const field = event?.contactFormFields?.find (
      f => String ( f.key ) === fieldKey || String ( f.key ).toLowerCase ( ) === fieldKey.toLowerCase ( )
    )
    const isCheckbox = field?.type === "checkbox" || typeof value === "boolean"
      || value === "true" || value === "false"

    if ( isCheckbox ) {
      return this.regCheckboxTruthy ( value ) ? "✓" : "✗"
    }

    if ( Array.isArray ( value ) ) return value.map ( v => this.formatRegFieldValue ( key, v ) ).join ( ", " )
    return String ( value )
  }

  public getRegDisplayName ( reg: Record<string, unknown> ): string {
    const name = reg [ "name" ]
      || this.getSummaryDetail ( reg [ "formData" ], [ "name", "Name", "firstName", "First Name" ] )
    return name === "—" ? "Unknown registrant" : String ( name )
  }

  public getRegEmail ( reg: Record<string, unknown> ): string {
    const direct = String ( reg [ "email" ] || "" ).trim ( )
    if ( direct ) return direct
    const fromForm = this.getSummaryDetail ( reg [ "formData" ], [ "email", "Email" ] )
    return fromForm === "—" ? "" : String ( fromForm ).trim ( )
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
    this.orgSvc.listAdminOrganizations ( ).then ( orgs => {
      this.adminOrganizations.set ( orgs )
      if ( orgs.length && !this.publishingOrganizationId ( ) ) {
        this.publishingOrganizationId.set ( orgs [ 0 ]!.id )
      }
    } ).catch ( ( ) => null ).finally ( ( ) => {
      Promise.all ( [
        this.loadEventData ( ),
        this.loadSlider ( )
      ] ).finally ( ( ) => {
        this.loading.set ( false )
        this.attachEventFormWatchers ( )
      } )
    } )
  }

  public onEventFormChange ( index: number, value: Record<string, unknown> ): void {
    this.eventsModified.set ( true )
    this.eventForm.update ( forms => {
      const cloned = [ ...forms ]
      if ( cloned [ index ] ) {
        const model = { ...cloned [ index ].model, ...value }
        syncEventEndDate ( model, cloned [ index ].form, model [ "multiDay" ] === true )
        cloned [ index ] = { ...cloned [ index ], model }
      }
      return cloned
    } )
  }

  public setActiveTab ( tab: EventTab ): void {
    this.expandedRegIds.set ( new Set ( ) )
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

  public isUnsavedEvent ( index: number ): boolean {
    return !String ( this.eventForm ( ) [ index ]?.model [ "id" ] || "" ).trim ( )
  }

  public listingEventDateLabel ( index: number ): string {
    const start = this.eventForm ( ) [ index ]?.model [ "startDate" ]
    if ( !start ) return ""
    const d = start instanceof Date ? start : new Date ( String ( start ) )
    if ( isNaN ( d.getTime ( ) ) ) return ""
    return d.toLocaleDateString ( "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" } )
  }

  public async addNewEvent ( ): Promise<void> {
    const startDate = addDays ( new Date ( ), 7 )
    const orgs = this.adminOrganizations ( )
    const organizationId = this.publishingOrganizationId ( ) || orgs [ 0 ]?.id || ""

    const fields: FormlyFieldConfig [ ] = [
      this.formlySvc.TextInput ( "title", {
        label: "Event title",
        placeholder: "e.g. Parish mission",
        required: true,
        maxLength: 100
      }, { }, true ),
      ...( orgs.length > 1
        ? [ this.formlySvc.SelectInput ( "organizationId", {
          label: "Publishing organisation",
          required: true,
          options: orgs.map ( o => ( { label: o.name, value: o.id } ) ),
          description: "Which partner booking page this event appears on."
        }, { } ) ]
        : [ ] ),
      {
        ...this.formlySvc.DateInput ( "startDate", {
          label: "Date",
          required: true,
          minDate: new Date ( )
        }, { } ),
        hooks: endDateSyncHooks ( "startDate" )
      },
      {
        ...this.formlySvc.CheckboxInput ( "multiDay", {
          label: "Lasts more than one day"
        }, { defaultValue: false } ),
        hooks: endDateSyncHooks ( "multiDay" )
      },
      this.formlySvc.DateInput ( "endDate", {
        label: "End date",
        minDate: addDays ( startDate, 1 )
      }, {
        expressions: {
          hide: ( field: FormlyFieldConfig ) => !field.model?.multiDay,
          "props.required": ( field: FormlyFieldConfig ) => !!field.model?.multiDay,
          "props.minDate": ( field: FormlyFieldConfig ) => dayAfterStart ( field.model?.startDate ) || addDays ( startDate, 1 )
        }
      } ),
      this.formlySvc.SelectInput ( "actionType", {
        label: "How people take part",
        required: true,
        options: [
          { label: "Registration form on this site", value: "form" },
          { label: "Link to an external page", value: "webpage" }
        ]
      }, { } ),
      this.formlySvc.CheckboxInput ( "comingSoon", {
        label: "Coming soon",
        description: "List it publicly, but keep registration closed until you are ready."
      }, { defaultValue: false } )
    ]

    const modalRef = this.modalSvc.open ( InputDialogComponent, { centered: true, size: "md" } )
    modalRef.setInput ( "title", "New event" )
    modalRef.setInput (
      "body",
      "Set the essentials. You can add the image, copy, and registration details next — then save."
    )
    modalRef.setInput ( "confirmText", "Continue" )
    modalRef.setInput ( "cancelText", "Cancel" )
    modalRef.setInput ( "fields", fields )
    modalRef.setInput ( "model", {
      title: "",
      organizationId,
      startDate,
      endDate: startDate,
      multiDay: false,
      actionType: "form",
      comingSoon: false
    } )

    let result: Record<string, unknown>
    try {
      result = await modalRef.result as Record<string, unknown>
    } catch {
      return
    }

    const title = String ( result [ "title" ] || "" ).trim ( )
    if ( !title ) return

    const resolvedOrg = String ( result [ "organizationId" ] || organizationId ).trim ( )
    const actionType = result [ "actionType" ] === "webpage" ? "webpage" as const : "form" as const
    const comingSoon = result [ "comingSoon" ] === true
    const asDate = ( value: unknown, fallback: Date ): Date => {
      if ( value instanceof Date && !isNaN ( value.getTime ( ) ) ) return value
      if ( value ) {
        const parsed = new Date ( String ( value ) )
        if ( !isNaN ( parsed.getTime ( ) ) ) return parsed
      }
      return fallback
    }
    const resolvedStart = asDate ( result [ "startDate" ], startDate )
    const multiDay = result [ "multiDay" ] === true
    const resolvedEnd = multiDay ? asDate ( result [ "endDate" ], resolvedStart ) : resolvedStart

    const defaultModel = {
      id: "",
      title,
      description: "",
      location: "",
      startDate: resolvedStart,
      endDate: resolvedEnd.getTime ( ) < resolvedStart.getTime ( ) ? resolvedStart : resolvedEnd,
      startTime: "19:00",
      endTime: "21:00",
      actionType,
      comingSoon,
      multiDay,
      donationRequired: "none" as const,
      organizationId: resolvedOrg,
      ...( actionType === "form"
        ? { contactFormFields: getDefaultRegistrationFields ( this.formlySvc ) }
        : { } )
    }

    this.eventsModified.set ( true )
    this.eventForm.set ( [
      {
        form: new FormGroup ( { } ),
        model: { ...defaultModel },
        fields: this.eventFieldsForModel ( defaultModel, 0 )
      },
      ...this.eventForm ( )
    ] )
    this.eventData.set ( {
      events: [ { ...defaultModel }, ...this.eventData ( ).events ]
    } )

    const shifted = new Set<number> ( )
    this.collapsedIndices.forEach ( i => shifted.add ( i + 1 ) )
    this.collapsedIndices = shifted

    const newForm = this.eventForm ( ) [ 0 ]?.form
    if ( newForm ) {
      this.attachWatcherToEventForm ( newForm )
    }

    this.dirtyManual.update ( d => ( { ...d, events: true } ) )
    this.toastrSvc.success ( "Draft added. Complete the details, then save." )
    queueMicrotask ( ( ) => {
      document.getElementById ( "event-card-0" )?.scrollIntoView ( { behavior: "smooth", block: "nearest" } )
    } )
  }

  public async saveEventData ( ) {
    if ( this.loading ( ) ) return
    if ( !this.someFormDirty ( ) ) return

    this.listingsSaveAttempted.set ( true )
    if ( this.someFormInvalid ( ) || this.allEventSaveIssues ( ).length > 0 ) {
      this.revealInvalidListings ( )
      this.toastrSvc.warning ( "Fill in the highlighted fields, then save." )
      return
    }

    const updatedEventData = {
      events: this.eventForm ( ).map ( ( ef, index ) => {
        const comingSoon = ef.model [ "comingSoon" ] === true
        const event: Event = {
          id: ( ef.model [ "id" ] as string )
            || this.eventData ( ).events [ index ]?.id
            || `event-${Date.now ( )}-${Math.floor ( Math.random ( ) * 1000 )}`,
          title: ef.model [ "title" ] as string,
          description: ef.model [ "description" ] as string,
          longDescription: ef.model [ "longDescription" ] as string | undefined,
          location: ef.model?. [ "location" ] as string || "",
          imageUrl: ef.model [ "imageUrl" ] as string,
          actionType: ( ef.model [ "actionType" ] === "form" || ef.model [ "actionType" ] === "contact" ? "form" : "webpage" ) as "webpage" | "form",
          comingSoon,
          organizationId: String (
            ef.model [ "organizationId" ]
            || ( ( ef.model [ "id" ] || this.eventData ( ).events [ index ]?.id )
              ? this.eventData ( ).events [ index ]?.organizationId
              : this.publishingOrganizationId ( ) )
            || ""
          ).trim ( ) || undefined
        }

        if ( ef.model [ "startDate" ] ) event.startDate = ef.model [ "startDate" ] as Date
        if ( ef.model [ "multiDay" ] === true && ef.model [ "endDate" ] ) {
          event.endDate = ef.model [ "endDate" ] as Date
        } else if ( ef.model [ "startDate" ] ) {
          event.endDate = ef.model [ "startDate" ] as Date
        }
        if ( ef.model [ "startTime" ] ) event.startTime = ef.model [ "startTime" ] as string
        if ( ef.model [ "endTime" ] ) event.endTime = ef.model [ "endTime" ] as string

        if ( !comingSoon ) {
          event.webpageUrl = ef.model [ "webpageUrl" ] as string
          event.contactFormFields = ef.model [ "contactFormFields" ] as FormlyFieldConfig [ ] || [ ]
          event.donationRequired = ef.model [ "donationRequired" ] as "required" | "none" | "optional" | undefined
          event.donationDescription = ef.model [ "donationDescription" ] as string
          event.donationPrice = ef.model [ "donationPrice" ] != null ? Math.round ( ( ef.model [ "donationPrice" ] as number ) * 100 ) : undefined
          event.stripeProductId = ef.model [ "stripeProductId" ] as string
          event.stripePriceId = ef.model [ "stripePriceId" ] as string
          event.maxAttendees = ef.model [ "maxAttendees" ] != null && ef.model [ "maxAttendees" ] !== ""
            ? Math.floor ( Number ( ef.model [ "maxAttendees" ] ) )
            : undefined
          event.waitlistEnabled = ef.model [ "waitlistEnabled" ] === true
        } else {
          if ( ef.model [ "webpageUrl" ] ) event.webpageUrl = ef.model [ "webpageUrl" ] as string
          if ( ef.model [ "contactFormFields" ] ) event.contactFormFields = ef.model [ "contactFormFields" ] as FormlyFieldConfig [ ]
          if ( ef.model [ "donationRequired" ] ) event.donationRequired = ef.model [ "donationRequired" ] as "required" | "none" | "optional"
          if ( ef.model [ "donationDescription" ] ) event.donationDescription = ef.model [ "donationDescription" ] as string
          if ( ef.model [ "donationPrice" ] != null ) {
            event.donationPrice = Math.round ( ( ef.model [ "donationPrice" ] as number ) * 100 )
          }
          if ( ef.model [ "stripeProductId" ] ) event.stripeProductId = ef.model [ "stripeProductId" ] as string
          if ( ef.model [ "stripePriceId" ] ) event.stripePriceId = ef.model [ "stripePriceId" ] as string
          if ( ef.model [ "maxAttendees" ] != null && ef.model [ "maxAttendees" ] !== "" ) {
            event.maxAttendees = Math.floor ( Number ( ef.model [ "maxAttendees" ] ) )
          }
          if ( ef.model [ "waitlistEnabled" ] === true ) event.waitlistEnabled = true
        }

        return event
      } )
    }

    if ( updatedEventData.events.some ( e => !e.title ) ) {
      this.toastrSvc.error ( "Please ensure all events have a title before saving." )
      return
    }

    this.loading.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/events", updatedEventData, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.eventData.set ( updatedEventData )
      this.eventsModified.set ( false )
      this.listingsSaveAttempted.set ( false )
      this.eventForm ( ).forEach ( ef => ef.form.markAsPristine ( ) )
      this.toastrSvc.success ( "Event data saved successfully!" )
    } catch ( err ) {
      console.error ( "Failed to save event data:", err )
      const msg = err instanceof HttpErrorResponse
        ? ( typeof err.error === "object" && err.error?. [ "error" ]
          ? String ( err.error [ "error" ] )
          : typeof err.error === "string" ? err.error : "Failed to save event data." )
        : "Failed to save event data."
      this.toastrSvc.error ( msg )
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
    return this.eventForm ( ).some ( ( ef, index ) => {
      if ( this.isListingEventFinished ( index ) ) return false
      return ef.form.invalid
    } )
  }

  public someFormDirty ( ): boolean {
    return this.eventsModified ( )
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

  public getEventTimeoutText ( _endDate?: string | Date ): string {
    return "Past event"
  }

  public togglePastEvents ( ): void {
    this.showPastEvents.update ( value => !value )
  }

  public regMatchesManagerFilter ( reg: Record<string, unknown>, filter: RegManagerFilter ): boolean {
    switch ( filter ) {
      case "all":
        return true
      case "waitlist":
        return reg [ "status" ] === "waitlist"
      case "checkout":
        return this.isAwaitingPayment ( reg )
      case "confirmed":
        return reg [ "status" ] === "completed" && !this.isAwaitingPayment ( reg )
      case "paid":
        return !!reg [ "paymentIntent" ]
      case "donation_due":
        return this.getRegStatus ( reg ).tone === "donation-unpaid"
      case "checked_in":
        return !!reg [ "attended" ] && this.canCheckInRegistration ( reg )
      default:
        return true
    }
  }

  public regMatchesSearchQuery ( reg: Record<string, unknown>, query: string ): boolean {
    const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
    const stringifiedValues = Object.entries ( formData )
      .map ( ( [ k, v ] ) => {
        const display = this.formatRegFieldValue ( k, v )
        const extra = display === "✓" ? " yes" : display === "✗" ? " no" : ""
        return ( display + extra ).toLowerCase ( )
      } )
      .join ( " " )
    const email = String ( reg [ "email" ] || "" ).toLowerCase ( )
    const name = String ( reg [ "name" ] || "" ).toLowerCase ( )
    const displayName = this.getRegDisplayName ( reg ).toLowerCase ( )
    const creationDate = String ( reg [ "createdAt" ] || "" ).toLowerCase ( )
    const regStatus = String ( reg [ "status" ] || "" ).toLowerCase ( )
    const statusLabel = this.getRegStatus ( reg ).label.toLowerCase ( )
    return stringifiedValues.includes ( query )
      || email.includes ( query )
      || name.includes ( query )
      || displayName.includes ( query )
      || creationDate.includes ( query )
      || regStatus.includes ( query )
      || statusLabel.includes ( query )
  }

  public activeRegManagerFilterLabel ( ): string {
    return this.regManagerFilterDefs.find ( d => d.id === this.regManagerFilter ( ) )?.label || "All"
  }

  public resetRegManagerFilters ( ): void {
    this.regManagerFilter.set ( "all" )
    this.regSearchQuery.set ( "" )
  }

  public getRegStatus ( reg: Record<string, unknown> ): { label: string; tone: RegStatusTone } {
    const status = String ( reg [ "status" ] || "" )
    const { mode, optIn, paid } = this.regDonationContext ( reg )

    if ( status === "waitlist" ) {
      return { label: "Waitlist", tone: "waitlist" }
    }

    if ( this.isAwaitingPayment ( reg ) ) {
      return { label: "Payment not finished", tone: "checkout" }
    }

    if ( status === "completed" ) {
      if ( mode === "none" ) {
        return { label: "Registered", tone: "confirmed" }
      }
      if ( paid ) {
        return mode === "required"
          ? { label: "Registered (paid)", tone: "paid" }
          : { label: "Registered (donated)", tone: "paid" }
      }
      if ( mode === "optional" && optIn ) {
        return { label: "Registered — donation unpaid", tone: "donation-unpaid" }
      }
      if ( mode === "optional" && !optIn ) {
        return { label: "Registered (no donation)", tone: "no-donation" }
      }
      if ( mode === "required" ) {
        return { label: "Registered — donation unpaid", tone: "donation-unpaid" }
      }
    }

    if ( status ) {
      return { label: status.replace ( /_/g, " " ), tone: "unknown" }
    }
    return { label: "Unknown", tone: "unknown" }
  }

  public regStatusLabel ( reg: Record<string, unknown> ): string {
    return this.getRegStatus ( reg ).label
  }

  public regStatusToneClasses ( tone: RegStatusTone ): string {
    switch ( tone ) {
      case "waitlist":
        return "bg-violet-100 text-violet-800 dark:bg-violet-900/35 dark:text-violet-200"
      case "checkout":
        return "bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-100"
      case "confirmed":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200"
      case "paid":
        return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
      case "donation-unpaid":
        return "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100"
      case "no-donation":
        return "bg-sky-100 text-sky-900 dark:bg-sky-900/35 dark:text-sky-100"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200"
    }
  }

  public async toggleAttendance ( reg: Record<string, unknown> ): Promise<void> {
    if ( !this.canCheckInRegistration ( reg ) ) return
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

  /** Checkout drafts vs saved registration rows (legacy rows without kind infer from status). */
  public registrationRowKind ( reg: Record<string, unknown> ): "draft" | "registration" {
    if ( reg [ "kind" ] === "draft" ) return "draft"
    if ( reg [ "kind" ] === "registration" ) return "registration"
    if ( reg [ "status" ] === "awaiting_payment" ) return "draft"
    return "registration"
  }

  /** Attendance applies to confirmed saved registrations — not drafts or waitlist. */
  public canCheckInRegistration ( reg: Record<string, unknown> ): boolean {
    if ( this.registrationRowKind ( reg ) === "draft" ) return false
    return String ( reg [ "status" ] || "" ) === "completed"
  }

  public canSendOptionalPayLink ( reg: Record<string, unknown> ): boolean {
    if ( this.isAwaitingPayment ( reg ) ) return false
    if ( reg [ "paymentIntent" ] ) return false
    if ( String ( reg [ "status" ] || "" ) !== "completed" ) return false
    if ( this.getSelectedEvent ( )?.donationRequired !== "optional" ) return false
    const { optIn } = this.regDonationContext ( reg )
    return optIn
  }

  public stripePaymentDashboardUrl ( paymentIntentId: string ): string {
    const base = this.stripeLivemode ( )
      ? "https://dashboard.stripe.com"
      : "https://dashboard.stripe.com/test"
    return `${base}/payments/${encodeURIComponent ( paymentIntentId )}`
  }

  public getEventRegistrationCount ( eventId: unknown ): number {
    const id = String ( eventId || "" ).trim ( )
    if ( !id ) return 0
    return this.registrationCounts ( ) [ id ] || 0
  }

  public formatGbpFromPence ( pence: number ): string {
    if ( !Number.isFinite ( pence ) ) return "—"
    return `£${( pence / 100 ).toFixed ( 2 )}`
  }

  public getRegPaymentPanel ( reg: Record<string, unknown> ): {
    amountPence: number
    amountLabel: string
    statusLabel: string
    statusTone: RegStatusTone
    stripePaymentId?: string
    payLink?: string
  } | null {
    const event = this.getSelectedEvent ( )
    if ( !event ) return null

    const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
    const donationRequired = event.donationRequired || "none"
    const optInDonation = formData [ "optInDonation" ] === true || formData [ "optInDonation" ] === "true"
    const hasPaymentIntent = !!reg [ "paymentIntent" ]
    const hasInvoice = !!reg [ "stripeInvoiceId" ]
    const amountPenceRaw = reg [ "amountPence" ]

    const show = donationRequired === "required"
      || ( donationRequired === "optional" && optInDonation )
      || hasPaymentIntent
      || hasInvoice
      || amountPenceRaw != null

    if ( !show ) return null

    const storedAmount = this.storedRegAmountPence ( reg )
    const amountPence = storedAmount ?? 0
    const amountLabel = storedAmount != null ? this.formatGbpFromPence ( storedAmount ) : "—"

    const regStatus = this.getRegStatus ( reg )

    const payLink = this.isAwaitingPayment ( reg )
      ? String ( reg [ "donateLaterUrl" ] || reg [ "checkoutUrl" ] || "" ).trim ( ) || undefined
      : undefined

    return {
      amountPence,
      amountLabel,
      statusLabel: regStatus.label,
      statusTone: regStatus.tone,
      stripePaymentId: hasPaymentIntent ? String ( reg [ "paymentIntent" ] ) : undefined,
      payLink
    }
  }

  public isListingEventFinished ( index: number ): boolean {
    const modelEnd = this.eventForm ( ) [ index ]?.model [ "endDate" ]
    const dataEnd = this.eventData ( ).events [ index ]?.endDate
    return this.isEventFinished ( modelEnd || dataEnd )
  }

  public storedRegAmountPence ( reg: Record<string, unknown> ): number | null {
    if ( reg [ "amountPence" ] != null && Number.isFinite ( Number ( reg [ "amountPence" ] ) ) ) {
      return Number ( reg [ "amountPence" ] )
    }
    const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
    const custom = formData [ "customDonationAmount" ]
    if ( custom != null && Number.isFinite ( Number ( custom ) ) ) {
      const n = Number ( custom )
      return n >= 50 ? Math.round ( n ) : Math.round ( n * 100 )
    }
    return null
  }

  public eventSaveIssueLabelsForIndex ( index: number ): string [ ] {
    const entry = this.eventForm ( ) [ index ]
    if ( !entry ) return [ ]
    if ( this.isListingEventFinished ( index ) ) return [ ]

    const model = entry.model
    const form = entry.form
    const issues: string [ ] = [ ]

    if ( !String ( model [ "title" ] || "" ).trim ( ) ) issues.push ( "Event title" )
    if ( !String ( model [ "description" ] || "" ).trim ( ) ) issues.push ( "Summary on event card" )
    if ( !model [ "imageUrl" ] ) issues.push ( "Event image" )

    const comingSoon = model [ "comingSoon" ] === true
    if ( !comingSoon ) {
      if ( !String ( model [ "location" ] || "" ).trim ( ) ) issues.push ( "Location" )
      if ( !model [ "startDate" ] ) issues.push ( model [ "multiDay" ] === true ? "Start date" : "Date" )
      if ( model [ "multiDay" ] === true && !model [ "endDate" ] ) issues.push ( "End date" )

      const actionType = model [ "actionType" ]
      if ( actionType === "webpage" ) {
        if ( !String ( model [ "webpageUrl" ] || "" ).trim ( ) ) {
          issues.push ( "External registration URL" )
        } else if ( form.get ( "webpageUrl" )?.invalid ) {
          issues.push ( "Valid external URL (https://…)" )
        }
      }

      if ( actionType === "form" ) {
        const fields = model [ "contactFormFields" ]
        if ( !Array.isArray ( fields ) || fields.length === 0 ) {
          issues.push ( "Registration form fields" )
        }
        const donation = model [ "donationRequired" ] || "none"
        if ( donation !== "none" ) {
          const price = Number ( model [ "donationPrice" ] )
          if ( !Number.isFinite ( price ) || price < 0.5 ) {
            issues.push ( "Donation price (min £0.50)" )
          }
        }
      }
    }

    if ( form.errors?. [ "StartBeforeEnd" ] ) {
      issues.push ( "End after start (date & time)" )
    }

    if ( form.invalid && !issues.length ) {
      issues.push ( "Fix highlighted fields above" )
    }

    return issues
  }

  public eventSaveIssuesForIndex ( index: number ): string [ ] {
    const entry = this.eventForm ( ) [ index ]
    if ( !entry ) return [ ]
    const title = String ( entry.model [ "title" ] || "" ).trim ( ) || `Event #${index + 1}`
    return this.eventSaveIssueLabelsForIndex ( index ).map ( label => `${title}: ${label}` )
  }

  public allEventSaveIssues ( ): string [ ] {
    return this.eventForm ( ).flatMap ( ( _, index ) => this.eventSaveIssuesForIndex ( index ) )
  }

  public canSaveEventListings ( ): boolean {
    return this.someFormDirty ( )
      && !this.someFormInvalid ( )
      && this.allEventSaveIssues ( ).length === 0
  }

  public eventNeedsAttention ( index: number ): boolean {
    return this.listingsSaveAttempted ( ) && this.eventSaveIssueLabelsForIndex ( index ).length > 0
  }

  public eventSaveFooterHint ( ): string {
    if ( !this.someFormDirty ( ) ) return "No unsaved changes."
    if ( this.listingsSaveAttempted ( ) && this.allEventSaveIssues ( ).length ) {
      return "Check the highlighted fields, then save again."
    }
    return "Unsaved changes."
  }

  public organizationName ( organizationId: unknown ): string {
    const id = String ( organizationId || "" ).trim ( )
    if ( !id ) return ""
    return this.adminOrganizations ( ).find ( o => o.id === id )?.name || id
  }

  public formEventOptionLabel ( event: Event ): string {
    const bits = [ event.title || "Untitled event" ]
    if ( event.startDate ) {
      const d = new Date ( event.startDate as unknown as string )
      if ( !isNaN ( d.getTime ( ) ) ) {
        bits.push ( d.toLocaleDateString ( "en-GB", { day: "numeric", month: "short", year: "numeric" } ) )
      }
    }
    if ( this.isEventFinished ( event.endDate ) ) bits.push ( "past" )
    if ( event.comingSoon ) bits.push ( "coming soon" )
    return bits.join ( " · " )
  }

  public exportRegistrationsCsv ( ): void {
    const rows = this.filteredRegistrations ( )
    if ( !rows.length ) {
      this.toastrSvc.info ( "Nothing to export for the current filter." )
      return
    }

    const headers = [ "Date", "Kind", "Status", "Name", "Email", "Phone", "Amount", "PaymentIntent", "Details" ]
    const escape = ( v: unknown ) => {
      let s = v == null ? "" : String ( v )
      // Neutralise Excel/Sheets formula injection on open
      if ( /^[=+\-@\t\r]/.test ( s ) ) {
        s = `'${s}`
      }
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
      const amountPence = this.storedRegAmountPence ( reg )
      const amount = amountPence != null && Number.isFinite ( amountPence )
        ? ( amountPence / 100 ).toFixed ( 2 )
        : ""
      const details = Object.entries ( formData )
        .filter ( ( [ k ] ) => !this.isCoreRegField ( k ) )
        .map ( ( [ k, v ] ) => `${this.getSelectedEventFieldLabel ( k )}=${this.formatRegFieldValue ( k, v )}` )
        .join ( "; " )

      lines.push ( [
        escape ( reg [ "createdAt" ] ),
        escape ( reg [ "kind" ] === "draft" ? "payment not finished" : "registration" ),
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
    this.copyEventPageLink ( eventId )
  }

  public getEventPageUrl ( eventId: unknown ): string {
    if ( !eventId || typeof eventId !== "string" ) return `${window.location.origin}/events`
    return `${window.location.origin}/events?eventId=${encodeURIComponent ( eventId )}`
  }

  public copyEventPageLink ( eventId: unknown ): void {
    const url = this.getEventPageUrl ( eventId )
    navigator.clipboard.writeText ( url ).then ( ( ) => {
      this.toastrSvc.success ( "Event page link copied to clipboard!" )
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

  public onRegEventSelect ( eventId: string ): void {
    this.expandedRegIds.set ( new Set ( ) )
    this.resetRegManagerFilters ( )
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
      .filter ( Boolean ).join ( " · " ) || ( isDraft ? "this unfinished payment" : "this registration" )

    const confirmed = window.confirm (
      isDraft
        ? `Remove unfinished payment for ${who}?\n\nAny open invoice or payment session will be cancelled.`
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
      if ( !isDraft ) {
        this.registrationCounts.update ( counts => ( {
          ...counts,
          [ eventId ]: Math.max ( 0, ( counts [ eventId ] || 1 ) - 1 )
        } ) )
      }

      if ( isDraft ) {
        this.toastrSvc.success ( "Unfinished payment removed." )
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

  private regCheckboxTruthy ( value: unknown ): boolean {
    return value === true || value === "true" || value === 1 || value === "1"
  }

  private isMultiDayRange ( startDate: unknown, endDate: unknown ): boolean {
    if ( !startDate || !endDate ) return false
    const start = startDate instanceof Date ? startDate : new Date ( String ( startDate ) )
    const end = endDate instanceof Date ? endDate : new Date ( String ( endDate ) )
    if ( isNaN ( start.getTime ( ) ) || isNaN ( end.getTime ( ) ) ) return false
    return start.getFullYear ( ) !== end.getFullYear ( )
      || start.getMonth ( ) !== end.getMonth ( )
      || start.getDate ( ) !== end.getDate ( )
  }

  private regDonationContext ( reg: Record<string, unknown> ): {
    mode: "none" | "optional" | "required"
    optIn: boolean
    paid: boolean
  } {
    const event = this.getSelectedEvent ( )
    const formData = ( reg [ "formData" ] || { } ) as Record<string, unknown>
    const mode = ( event?.donationRequired || "none" ) as "none" | "optional" | "required"
    const optIn = formData [ "optInDonation" ] === true || formData [ "optInDonation" ] === "true"
    const paid = !!reg [ "paymentIntent" ]
    return { mode, optIn, paid }
  }

  private revealInvalidListings ( ): void {
    this.eventForm ( ).forEach ( ( ef, index ) => {
      if ( this.isListingEventFinished ( index ) ) return
      ef.form.markAllAsTouched ( )
    } )

    const first = this.eventForm ( ).findIndex ( ( _, index ) =>
      !this.isListingEventFinished ( index ) && this.eventSaveIssueLabelsForIndex ( index ).length > 0
    )
    if ( first < 0 ) return
    this.collapsedIndices.delete ( first )
    queueMicrotask ( ( ) => {
      const card = document.getElementById ( `event-card-${first}` )
      card?.scrollIntoView ( { behavior: "smooth", block: "nearest" } )
      const field = card?.querySelector<HTMLElement> ( ".border-red-500, .is-invalid, input, textarea, select" )
      field?.focus ( { preventScroll: true } )
    } )
  }

  private compareRegsForSort (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    sort: RegManagerSort
  ): number {
    if ( sort === "name_az" ) {
      return this.getRegDisplayName ( a ).localeCompare ( this.getRegDisplayName ( b ), undefined, { sensitivity: "base" } )
    }
    const ta = new Date ( String ( a [ "createdAt" ] || 0 ) ).getTime ( )
    const tb = new Date ( String ( b [ "createdAt" ] || 0 ) ).getTime ( )
    return sort === "oldest" ? ta - tb : tb - ta
  }

  private eventFieldsForModel (
    model: Record<string, unknown>,
    registrationCount: number
  ): FormlyFieldConfig [ ] {
    return getEventFields ( this.formlySvc, model, {
      registrationCount,
      organizations: this.adminOrganizations ( ).map ( o => ( { id: o.id, name: o.name } ) )
    } )
  }

  private attachEventFormWatchers ( ): void {
    for ( const ef of this.eventForm ( ) ) {
      this.attachWatcherToEventForm ( ef.form )
    }
  }

  private attachWatcherToEventForm ( form: FormGroup ): void {
    if ( this.attachedEventForms.has ( form ) ) {
      return
    }
    this.attachedEventForms.add ( form )
    afterNextRender ( ( ) => {
      form.valueChanges
        .pipe ( takeUntilDestroyed ( this.destroyRef ) )
        .subscribe ( ( ) => {
          if ( form.dirty ) {
            this.eventsModified.set ( true )
          }
        } )
    } )
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
      const res = ( await this.apiSvc.get (
        "/api/admin/events",
        { },
        new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
      ) ) as { events: Event [ ]; registrationCounts?: Record<string, number>; stripeLivemode?: boolean }
      this.eventData.set ( { events: res.events } )
      this.registrationCounts.set ( res.registrationCounts || { } )
      if ( typeof res.stripeLivemode === "boolean" ) {
        this.stripeLivemode.set ( res.stripeLivemode )
      }
      this.eventForm.set ( res.events.map ( event => {
        const model = {
          ...event,
          actionType: event.actionType === "form" || ( event.actionType as string ) === "contact" ? "form" : "webpage",
          startDate: event.startDate ? new Date ( event.startDate ) : null,
          endDate: event.endDate ? new Date ( event.endDate ) : null,
          multiDay: this.isMultiDayRange ( event.startDate, event.endDate ),
          donationPrice: event.donationPrice != null ? event.donationPrice / 100 : undefined,
          organizationId: event.organizationId
            || this.publishingOrganizationId ( )
            || this.adminOrganizations ( ) [ 0 ]?.id
        }
        return {
          form: new FormGroup ( { } ),
          model,
          fields: this.eventFieldsForModel (
            model as Record<string, unknown>,
            this.getEventRegistrationCount ( event.id )
          )
        }
      } ) )
      res.events.forEach ( ( _, i ) => this.collapsedIndices.add ( i ) )
    } catch ( error ) {
      console.error ( "Error loading event data:", error )
    }
  }
}
