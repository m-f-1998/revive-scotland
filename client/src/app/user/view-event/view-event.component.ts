import { ChangeDetectionStrategy, Component, Input, OnInit, signal, WritableSignal } from "@angular/core"
import { faCheck, faSpinner, faWarning } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { ApiService } from "@services/api.service"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { DatesService } from "@services/dates.service"
import { CurrencyPipe } from "@angular/common"

@Component ( {
  selector: "app-view-event",
  imports: [
    FaIconComponent,
    FormlyModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [
    CurrencyPipe
  ],
  templateUrl: "./view-event.component.html",
  styleUrl: "./view-event.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ViewEventComponent implements OnInit {
  @Input ( ) public event: any = { }
  public policies: WritableSignal<Array<any>> = signal ( [ ] )

  public loading: WritableSignal<boolean> = signal ( true )
  public error: WritableSignal<boolean> = signal ( false )
  public errorMessage: WritableSignal<string> = signal ( "" )
  public processing: WritableSignal<boolean> = signal ( false )
  public processingSuccess: WritableSignal<boolean> = signal ( false )
  public paymentLink: WritableSignal<string> = signal ( "" )
  public faSpinner = faSpinner
  public faWarning = faWarning

  public eventModel: any = { }
  public eventForm = new FormGroup ( { } )
  public eventFields: FormlyFieldConfig [ ] = [ ]

  public model: any = { }
  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]

  public faCheck = faCheck

  public constructor (
    private apiSvc: ApiService,
    private activeModal: NgbActiveModal,
    private dateSvc: DatesService,
    private currencyPipe: CurrencyPipe
  ) { }

  public getPolicies ( ) {
    return new Promise ( ( resolve ) => {
      this.policies.set ( [ ] )
      resolve ( [ ] )
    } )
  }

  public ngOnInit ( ) {
    this.getPolicies ( ).then ( ( ) => {
      this.eventFields = [
        {
          key: "location",
          type: "input",
          props: {
            label: "Location",
            readonly: true
          }
        },
        {
          key: "price",
          type: "input",
          props: {
            type: "text",
            label: this.event.payment_required ? "Suggested Donation (GBP)" : "Price (GBP)",
            readonly: true
          }
        },
        {
          key: "date_from",
          type: "input",
          props: {
            type: "date",
            label: "Date From",
            readonly: true
          }
        },
        {
          key: "event_policy",
          type: "textarea",
          props: {
            label: "Event Policy",
            readonly: true,
          }
        },
        {
          key: "gdpr",
          type: "textarea",
          props: {
            label: "GDPR",
            readonly: true,
          }
        }
      ]

      if ( this.event.description ) {
        this.eventFields.unshift ( {
          key: "description",
          type: "textarea",
          props: {
            label: "Description",
            readonly: true
          }
        } )
      }

      if ( this.event.featured_image ) {
        this.eventFields.push ( {
          key: "current_featured_image",
          type: "formly-link",
          defaultValue: this.event.featured_image,
          props: {
            label: "Featured Image",
          }
        } )
      }

      if ( this.event.poster_link ) {
        this.eventFields.push ( {
          key: "current_poster",
          type: "formly-link",
          defaultValue: this.event.poster_link,
          props: {
            label: "Poster",
          }
        } )
      }

      if ( this.event.timetable_link ) {
        this.eventFields.push ( {
          key: "current_timetable",
          type: "formly-link",
          defaultValue: this.event.timetable_link,
          props: {
            label: "Timetable",
          }
        } )
      }

      if ( this.event.date_to ) {
        const dateFromIndex = this.eventFields.findIndex ( x => x.key === "date_from" )
        this.eventFields.splice ( dateFromIndex + 1, 0, {
          key: "date_to",
          type: "input",
          props: {
            type: "date",
            label: "Date To",
            readonly: true
          }
        } )
      }

      this.eventModel = {
        description: this.event.description,
        location: this.event.location,
        date_from: this.dateSvc.reformat ( this.event.date_from, "yyyy-MM-dd" ),
        date_to: this.event.date_to ? this.dateSvc.reformat ( this.event.date_to, "yyyy-MM-dd" ) : "",
        price: this.currencyPipe.transform ( this.event.price, "GBP" ),
        event_policy: this.event.policy_description ?? "",
        gdpr: this.event.gdpr_description ?? ""
      }

      this.fields = [
        {
          key: "name",
          type: "input",
          props: {
            label: "Name",
            required: true
          }
        },
        {
          key: "telephone",
          type: "input",
          validators: {
            validation: [ "ValidPhone" ],
          },
          props: {
            label: "Phone Number",
            required: true
          }
        },
        {
          key: "email",
          type: "input",
          validators: {
            validation: [ "ValidEmail" ],
          },
          props: {
            label: "Email",
            required: true,
          }
        },
        {
          key: "emergency_contact_name",
          type: "input",
          props: {
            label: "Emergency Contact (Name)",
            required: true
          }
        },
        {
          key: "emergency_contact_number",
          type: "input",
          validators: {
            validation: [ "ValidPhone" ],
          },
          props: {
            label: "Emergency Contact (Number)",
            required: true
          }
        },
        {
          key: "dob",
          type: "input",
          props: {
            type: "date",
            label: "Date of Birth",
            required: true
          }
        },
        {
          key: "allergies_or_medical_requirements",
          type: "textarea",
          props: {
            label: "Allergies or Medical Requirements",
            required: true
          }
        },
        {
          key: "accepted_gdpr",
          type: "checkbox",
          props: {
            label: "Accept GDPR",
            required: true
          }
        },
        {
          key: "accepted_event_policy",
          type: "checkbox",
          props: {
            label: "Accept Event Policy",
            required: true
          }
        }
      ]

      this.model = {
        accepted_gdpr: false,
        accepted_event_policy: false
      }

      this.loading.set ( false )
    } ).catch ( ( e: any ) => {
      this.errorMessage = e.error
      this.error.set ( true )
      this.loading.set ( false )
      console.error ( e )
    } )
  }

  public close ( ) {
    this.activeModal.close ( )
  }

  public register ( ) {
    console.log ( "Go to register..." )
  }
}
