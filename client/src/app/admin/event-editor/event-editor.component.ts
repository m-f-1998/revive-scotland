import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { Event } from "../../interfaces/event.interface"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { FormlyService } from "../../services/formly.service"
import { HttpErrorResponse, HttpHeaders } from "@angular/common/http"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"

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

@Component ( {
  selector: "app-admin-event-editor",
  imports: [
    AdminNavbarComponent,
    IconComponent,
    FormlyForm,
    AdminFooterComponent
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

  // Section collapse state — all start closed
  public collapsed: WritableSignal<Record<string, boolean>> = signal ( { slider: true } )
  public saving: WritableSignal<Record<string, boolean>> = signal ( { } )
  public defaultSections: WritableSignal<Record<string, boolean>> = signal ( { } )
  public dirtyManual: WritableSignal<Record<string, boolean>> = signal ( { } )

  // Slider section state
  public sliderForms: WritableSignal<SlideFormEntry [ ]> = signal ( [ ] )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    Promise.all ( [
      this.loadEventData ( ),
      this.loadSlider ( )
    ] ).finally ( ( ) => this.loading.set ( false ) )
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

  public toggleSection ( key: string ): void {
    this.collapsed.update ( c => ( { ...c, [ key ]: !c [ key ] } ) )
  }

  public toggleCollapsed ( index: number ): void {
    if ( this.collapsedIndices.has ( index ) ) {
      this.collapsedIndices.delete ( index )
    } else {
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
      actionType: "webpage" as const
    }
    this.eventsModified.set ( true )
    this.eventForm.set ( [
      ...this.eventForm ( ),
      {
        form: new FormGroup ( { } ),
        model: { ...defaultModel },
        fields: this.getEventFields ( )
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
          actionType: ef.model [ "actionType" ] as "webpage" | "contact",
          webpageUrl: ef.model [ "webpageUrl" ] as string,
          contactFormFields: ef.model [ "contactFormFields" ] as FormlyFieldConfig [ ] || [ ]
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
  }

  public removeSliderHero ( index: number ): void {
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.sliderForms.update ( forms => forms.filter ( ( _, i ) => i !== index ) )
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
      this.formlySvc.ImagePickerInput ( "url", { label: "Image", required: true } )
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
        fields: [ ...this.getEventFields ( ) ]
      } ) ) )
      events.events.forEach ( ( _, i ) => this.collapsedIndices.add ( i ) )
    } catch ( error ) {
      console.error ( "Error loading event data:", error )
    }
  }

  private getEventFields ( ): FormlyFieldConfig [ ] {
    return [
      this.formlySvc.TextInput ( "title", {
        label: "Event Title",
        placeholder: "Enter event title",
        required: true,
        maxLength: 100,
        includeMaxDescription: true
      }, { } ),
      this.formlySvc.TextAreaInput ( "description", {
        label: "Event Description",
        placeholder: "Enter event description",
        required: true,
        maxLength: 500,
        includeMaxDescription: true
      }, { } ),
      this.formlySvc.AddressAutocompleteInput ( "location", {
        label: "Event Location",
        required: true,
        maxLength: 200
      }, { } ),
      this.formlySvc.DateInput ( "startDate", {
        label: "Start Date",
        placeholder: "Select start date",
        required: true,
        minDate: new Date ( )
      }, { } ),
      this.formlySvc.DateInput ( "endDate", {
        label: "End Date",
        placeholder: "Select end date",
        required: true,
        minDate: new Date ( )
      }, { } ),
      this.formlySvc.ImagePickerInput ( "imageUrl", {
        label: "Event Image",
        required: true
      }, { } ),
      this.formlySvc.SelectInput ( "actionType", {
        label: "Registration Type",
        options: [
          { label: "External Link", value: "webpage" },
          { label: "Registration Form", value: "contact" }
        ],
        required: true
      }, {
        defaultValue: "webpage"
      } ),
      this.formlySvc.TextInput ( "webpageUrl", {
        label: "External URL",
        placeholder: "Enter the external registration URL"
      }, {
        validators: {
          validation: [ "ValidWebPageURL" ]
        },
        expressions: {
          "props.required": ( formlyField: FormlyFieldConfig ) => formlyField.model.actionType === "webpage",
          hide: ( formlyField: FormlyFieldConfig ) => formlyField.model.actionType !== "webpage"
        }
      } ),
      {
        key: "contactFormFields",
        type: "repeat",
        props: {
          addText: "Add Field",
        },
        expressions: {
          "props.required": ( formlyField: FormlyFieldConfig ) => ( formlyField.form?.value || { } ).actionType === "contact",
          hide: ( formlyField: FormlyFieldConfig ) => ( formlyField.form?.value || { } ).actionType !== "contact"
        }
      }
    ]
  }
}
