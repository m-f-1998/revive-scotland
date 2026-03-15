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
import { NgbCollapse } from "@ng-bootstrap/ng-bootstrap"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "app-admin-event-editor",
  imports: [
    AdminNavbarComponent,
    IconComponent,
    FormlyForm,
    NgbCollapse,
    AdminFooterComponent
  ],
  templateUrl: "./event-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public eventForm: WritableSignal<Array<{ form: FormGroup; model: Record<string, unknown>; fields: FormlyFieldConfig [ ] }>> = signal ( [ ] )
  public eventData: WritableSignal<{ events: Event[] }> = signal ( { events: [ ] } )
  public isCollapsed: boolean = false

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
      // POST data to the new Firestore backend router
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
    return this.eventForm ( ).some ( ef => {
      return ef.form.invalid
    } )
  }

  private async loadEventData ( ): Promise<void> {
    try {
      const events = ( await this.apiSvc.get ( "/api/admin/events" ) ) as { events: Event [ ] }
      this.eventData.set ( events )
      this.eventForm.set ( events.events.map ( event => {
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