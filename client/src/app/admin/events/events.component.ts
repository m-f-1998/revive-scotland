import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { Event } from "../../interfaces/events.interface"
import { ApiService } from "../../services/api.service"
import { DatePipe } from "@angular/common"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component"
import { EventsService } from "../../services/events.service"
import { IconService } from "../../services/icons.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { FormlyService } from "../../services/formly.service"
import { FormlyFieldConfig } from "@ngx-formly/core"

@Component ( {
  selector: "app-admin-events",
  imports: [
    DatePipe,
    NavigationBarComponent,
    FaIconComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminEventsComponent {
  public events: WritableSignal<Event[]> = signal<Event[]> ( [ ] )
  public loading: WritableSignal<boolean> = signal<boolean> ( true )
  public eventFields : FormlyFieldConfig [ ] = [ ]

  public readonly apiSvc: ApiService = inject ( ApiService )
  public readonly iconSvc: IconService = inject ( IconService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly eventsSvc: EventsService = inject ( EventsService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )
  private readonly formlySvc: FormlyService = inject ( FormlyService )

  public constructor ( ) {
    this.eventsSvc.getEvents ( ).then ( events => {
      this.events.set ( events || [ ] )
      this.eventFields = [
        this.formlySvc.TextInput ( "title", {
          label: "Title",
          required: true,
          maxLength: 50
        } ),
        this.formlySvc.TextAreaInput ( "description", {
          label: "Description"
        } ),
        {
          fieldGroupClassName: "d-flex gap-3",
          fieldGroup: [
            this.formlySvc.DateInput ( "start_date", {
              label: "Event Start Date"
            } ),
            this.formlySvc.TimePickerInput ( "start_time", {
              label: "Event Start Time"
            } )
          ]
        },
        {
          fieldGroupClassName: "d-flex gap-3",
          fieldGroup: [
            this.formlySvc.DateInput ( "end_date", {
              label: "Event End Date"
            } ),
            this.formlySvc.TimePickerInput ( "end_time", {
              label: "Event End Time"
            } )
          ]
        },
        this.formlySvc.LocationInput ( "location" ),
        this.formlySvc.FileInput ( "showcase_image", {
          label: "Showcase Image",
          attributes: {
            "accept": "image/*"
          }
        } ),
        this.formlySvc.CheckboxInput ( "donation_requested", {
          label: "Is a donation requested for this event?",
          hidden: true
        }, {
          expressions: {
            hide: () => {
              return true
            }
          }
        } ),
        this.formlySvc.NumberInput ( "donation_amount", {
          label: "Requested Donation Amount (in GBP)",
          min: 0,
          step: 0.01
        }, {
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              return !field.model?.donation_requested
            }
          }
        } ),
        this.formlySvc.CheckboxInput ( "payment_required", {
          label: "Is payment required for this event?"
        }, {
          expressions: {
            hide: () => {
              return true
            }
          }
        } ),
        this.formlySvc.NumberInput ( "payment_amount", {
          label: "Payment Amount (in GBP)",
          min: 0,
          step: 0.01
        }, {
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              return !field.model?.payment_required
            },
            required: ( field: FormlyFieldConfig ) => {
              return !!field.model?.payment_required
            }
          }
        } ),
        this.formlySvc.Radio ( "action", {
          label: "What do you want to do?",
          required: true,
          options: [
            {
              label: "Go To External Link",
              value: "external_link"
            },
            {
              label: "Complete Registration Form",
              value: "registration_form"
            }
          ]
        } ),
        this.formlySvc.TextInput ( "action_url", {
          label: "Action URL",
          placeholder: "https://example.com"
        }, {
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              return !field.model?.action
            },
            required: ( field: FormlyFieldConfig ) => {
              return !!field.model?.action
            }
          }
        } ),
        this.formlySvc.TextInput ( "action_btn_text", {
          label: "Label for Action Button",
          maxLength: 30
        }, {
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              return !field.model?.action
            },
            required: ( field: FormlyFieldConfig ) => {
              return !!field.model?.action
            }
          }
        } ),
        // Add Fields for creating a form
        this.formlySvc.EmailInput ( "submit_details_email", {
          label: "Email to send registration details to",
          placeholder: "Enter email address..."
        }, {
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              return field.model?.action !== "registration_form"
            },
            required: ( field: FormlyFieldConfig ) => {
              return field.model?.action === "registration_form"
            }
          }
        } )
        // Add Fields for Processing Donation
        // Add Fields for Processing Payment
      ]
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public createEvent ( ): void {
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      size: "lg",
      backdrop: "static"
    } )
    modalRef.componentInstance.title = "Create New Event"
    modalRef.componentInstance.confirmText = "Create Event"
    modalRef.componentInstance.cancelText = "Cancel"
    modalRef.componentInstance.fields = this.eventFields
  }

  public editEvent ( event: Event ): void {
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      size: "lg",
      backdrop: "static"
    } )
    modalRef.componentInstance.title = "Edit Event"
    modalRef.componentInstance.confirmText = "Save Changes"
    modalRef.componentInstance.cancelText = "Cancel"
    modalRef.componentInstance.fields = this.eventFields
    modalRef.componentInstance.model = {
      ...event,
      start_date: event.start ? new Date ( event.start ) : null,
      start_time: event.start ? new Date ( `1970-01-01T${ new Date ( event.start ).toTimeString ( ).split ( " " ) [ 0 ] }:00` ) : null,
      end_date: event.end ? new Date ( event.end ) : null,
      end_time: event.end ? new Date ( `1970-01-01T${ new Date ( event.end ).toTimeString ( ).split ( " " ) [ 0 ] }:00` ) : null,
      // location: event.location?.id || null,
      showcase_image: null
    }
  }

  public deleteEvent ( event: Event ): void {
    if ( confirm ( `Are you sure you want to delete the event: '${ event.title }'` ) ) {
      this.apiSvc.post ( `/api/events/delete`, { id: event.id } ).then ( ( ) => {
        this.events.set ( this.events ( ).filter ( e => e.id !== event.id ) )
        this.toastrSvc.success ( "Event has been deleted." )
      } ).catch ( err => {
        console.error ( "Error deleting event:", err )
        this.toastrSvc.error ( "Please try again.", "There was an error deleting the event." )
      } )
    }
  }
}