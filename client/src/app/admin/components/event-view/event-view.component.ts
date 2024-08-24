import { CurrencyPipe } from "@angular/common"
import { AfterViewChecked, ChangeDetectorRef, Component, Input, OnInit } from "@angular/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { DatesService } from "@services/DateService.service"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-event-view",
  standalone: true,
  imports: [
    FaIconComponent,
    ReactiveFormsModule,
    FormsModule,
    FormlyModule
  ],
  providers: [
    CurrencyPipe
  ],
  templateUrl: "./event-view.component.html"
} )
export class EventViewComponent implements OnInit, AfterViewChecked {
  @Input ( ) public event: any = ""
  public policies: any[] = []

  public loading = true
  public faSpinner = faSpinner
  public confirm = false

  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]
  public model: any = { }

  public constructor (
    private apiSvc: HttpService,
    private dateSvc: DatesService,
    private activeModal: NgbActiveModal,
    private toastrSvc: ToastrService,
    private changeDetector: ChangeDetectorRef
  ) { }

  public ngOnInit ( ) {
    this.getPolicies ( ).then ( ( ) => {
      this.fields = [
        {
          key: "title",
          type: "input",
          props: {
            label: "Title",
            required: true
          }
        },
        {
          key: "description",
          type: "textarea",
          props: {
            label: "Description",
            required: true
          }
        },
        {
          key: "location",
          type: "input",
          props: {
            label: "Location",
            required: true
          }
        },
        {
          key: "price",
          type: "input",
          props: {
            type: "number",
            label: "Price (GBP)",
            required: true
          }
        },
        {
          key: "payment_required",
          type: "checkbox",
          props: {
            label: "Payment Required (?)",
            required: true
          }
        },
        {
          key: "date_from",
          type: "input",
          props: {
            type: "date",
            label: "Date From",
            required: true
          }
        },
        {
          key: "date_to",
          type: "input",
          props: {
            type: "date",
            label: "Date To",
          }
        },
        {
          key: "current_featured_image",
          type: "formly-link",
          defaultValue: this.event.featured_image,
          props: {
            label: "Current Featured Image",
            required: false,
          },
          hide: this.event.featured_image === ''
        },
        {
          key: "featured_image",
          id: "featured_image",
          type: "input",
          props: {
            type: "file",
            label: "Featured Image",
            required: false
          }
        },
        {
          key: "current_poster",
          id: "current_poster",
          type: "formly-link",
          defaultValue: this.event.poster_link,
          props: {
            label: "Current Poster",
            required: false,
          },
          hide: this.event.poster_link === ''
        },
        {
          key: "poster_link",
          id: "poster_link",
          type: "input",
          props: {
            type: "file",
            label: "Poster",
            required: false
          }
        },
        {
          key: "current_timetable",
          type: "formly-link",
          defaultValue: this.event.current_timetable,
          props: {
            label: "Current Timetable",
            required: false,
          },
          hide: this.event.timetable_link === ""
        },
        {
          key: "timetable_link",
          id: "timetable_link",
          type: "input",
          props: {
            type: "file",
            label: "Timetable",
            required: false
          }
        },
        {
          key: "policy_id",
          type: "select",
          defaultValue: this.event.policy_id,
          props: {
            label: "Policy",
            required: true,
            options: this.policies.filter ( x => x.category === "Event Policy" ).map ( x => ( { label: x.title, value: x.id } ) )
          }
        },
        {
          key: "gdpr_id",
          type: "select",
          defaultValue: this.event.gdpr_id,
          props: {
            label: "GDPR",
            required: true,
            options: this.policies.filter ( x => x.category === "GDPR" ).map ( x => ( { label: x.title, value: x.id } ) )
          }
        }
      ]

      this.model = {
        title: this.event.title,
        description: this.event.description,
        location: this.event.location,
        date_from: this.dateSvc.reformat ( new Date ( this.event.date_from ), "yyyy-MM-dd" ),
        date_to: this.event.date_to ? this.dateSvc.reformat ( new Date ( this.event.date_to ), "yyyy-MM-dd" ) : "",
        price: this.event.price,
        payment_required: this.event.payment_required,
        policy_id: this.event.policy_id ?? "",
        gdpr_id: this.event.gdpr_id ?? ""
      }
      this.loading = false
    } )
  }

  public ngAfterViewChecked ( ) {
    this.changeDetector.detectChanges ( )
  }

  public getPolicies ( ) {
    return this.apiSvc.request ( "/policies.php" ).then ( ( res: any ) => {
      this.policies = res
    } ).catch ( e => {
      console.error ( e )
      this.toastrSvc.error ( "Failed to Load Policies" )
    } )
  }

  public submit ( ) {
    const fd = new FormData ( )
    fd.append ( "id", this.event.id )
    if ( this.storeFile ( "featured_image" ) ) {
      if ( this.storeFile ( "poster_link" ) ) {
        if ( this.storeFile ( "timetable_link" ) ) {
          for ( const key of Object.keys ( this.model ) ) {
            if ( this.model [ key ] instanceof File ) {
              fd.append ( key, this.model [ key ].name )
              fd.append ( key, this.model [ key ], this.model [ key ].name )
            } else if ( typeof this.model [ key ] === "boolean" ) {
              fd.append ( key, this.model [ key ] ? "1" : "0" )
            } else {
              fd.append ( key, this.model [ key ] )
            }
          }
          this.apiSvc.request ( "/events.php", fd, "POST" ).then ( ( res: any ) => {
            this.confirm = true
          } ).catch ( e => {
            this.toastrSvc.error ( "Failed to Add Event" )
          } ).finally ( ( ) => {
            this.close ( )
          } )
        }
      }
    }
  }

  public storeFile ( key: string ) {
    const files = ( document.getElementById ( key ) as HTMLInputElement ).files
    if ( files && files.length > 0 ) {
      const file = files.item ( 0 )!
      if ( file.type.match ( /image\/(jpeg|jpg|png)/ ) || file.type === "application/pdf" ) {
        this.model [ key ] = files.item ( 0 )
      } else {
        this.toastrSvc.error (  "File extension not allowed, please choose a JPEG, JPG, PNG or PDF file." )
        return false
      }
    }
    return true
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
