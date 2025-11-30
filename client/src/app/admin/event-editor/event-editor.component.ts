import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { Event } from "../../interfaces/event.interface"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { FormlyService } from "../../services/formly.service"
import { HttpHeaders } from "@angular/common/http"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Component ( {
  selector: "app-admin-event-editor",
  imports: [
    AdminNavbarComponent,
    FaIconComponent,
    FormlyForm
  ],
  templateUrl: "./event-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public eventForm: WritableSignal<Array<{ form: FormGroup; model: any; fields: FormlyFieldConfig [ ] }>> = signal ( [ ] )
  public eventData: WritableSignal<{ events: Event[] }> = signal ( { events: [ ] } )

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.loadEventData ( ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public addNewEvent ( ): void {
    this.eventForm.set ( [
      ...this.eventForm ( ),
      {
        form: new FormGroup ( { } ),
        model: { },
        fields: this.getEventFields ( )
      }
    ] )
    this.eventData.set ( {
      events: [
        ...this.eventData ( ).events,
        {
          id: "",
          title: "",
          description: "",
          location: "",
          startDate: new Date ( ),
          endDate: new Date ( ),
          actionType: "webpage"
        }
      ]
    } )
  }

  public async saveEventData ( ) {
    if ( this.loading ( ) ) return
    // Create the new event data from the forms
    const updatedEventData: { events: Event [ ] } = {
      events: this.eventForm ( ).map ( ef => ( {
        id: ef.model.id || `event-${Date.now ( )}-${Math.floor ( Math.random ( ) * 1000 )}`,
        title: ef.model.title,
        description: ef.model.description,
        location: ef.model.location,
        imageUrl: ef.model.imageUrl,
        startDate: ef.model.startDate?.toISOString ( ) || null,
        endDate: ef.model.endDate?.toISOString ( ) || null,
        actionType: ef.model.actionType,
        webpageUrl: ef.model.webpageUrl
      } ) )
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
      this.toastrSvc.success ( "Event data saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save event data." )
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
      // POST data to the new Firestore backend router
      await this.apiSvc.delete ( `/api/admin/events`, { }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.toastrSvc.success ( "Event removed successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to remove event." )
    } finally {
      this.loading.set ( false )
    }
  }

  private async loadEventData ( ): Promise<void> {
    try {
      const events = ( await this.apiSvc.get ( "/api/admin/events" ) ) as { events: Event [ ] }
      this.eventData.set ( events )
      this.eventForm.set ( events.events.map ( event => {
        console.log ( new Date ( event.startDate ), event.startDate )
        return {
          form: new FormGroup ( { } ),
          model: {
            ...event,
            startDate: event.startDate ? new Date ( event.startDate ) : null,
            endDate: event.endDate ? new Date ( event.endDate ) : null
          },
          fields: [
            ...this.getEventFields ( )
          ]
        }
      } ) )
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
        required: true
      }, { } ),
      this.formlySvc.DateInput ( "endDate", {
        label: "End Date",
        placeholder: "Select end date",
        required: true
      }, { } ),
      this.formlySvc.ImagePickerInput ( "imageUrl", {
        label: "Event Image",
        required: true
      }, { } ),
      this.formlySvc.SelectInput ( "actionType", {
        label: "Action Type",
        options: [
          { label: "Webpage", value: "webpage" },
          { label: "Contact Form", value: "contact" }
        ],
        required: true
      }, {
        defaultValue: "webpage"
      } ),
      this.formlySvc.TextInput ( "webpageUrl", {
        label: "Webpage URL",
        placeholder: "Enter Webpage URL"
      }, {
        validators: {
          validation: [ "ValidWebPageURL" ]
        },
        expressions: {
          "props.required": ( formlyField: FormlyFieldConfig ) => formlyField.model.actionType === "webpage",
          hide ( formlyField: FormlyFieldConfig ) {
            return formlyField.model.actionType !== "webpage"
          }
        }
      } )
    ]
  }
}