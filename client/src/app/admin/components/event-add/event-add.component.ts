import { CurrencyPipe } from "@angular/common"
import { AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { ApiService } from "@services/api.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-event-add",
  imports: [
    FaIconComponent,
    ReactiveFormsModule,
    FormsModule,
    FormlyModule
  ],
  providers: [
    CurrencyPipe
  ],
  templateUrl: "./event-add.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventAddComponent implements OnInit, AfterViewChecked {
  public loading: WritableSignal<boolean> = signal ( true )
  public faSpinner = faSpinner
  public confirm: WritableSignal<boolean> = signal ( false )
  public policies: WritableSignal<Array<any>> = signal ( [ ] )

  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]
  public model: any = {
    payment_required: true
  }

  public constructor (
    private activeModal: NgbActiveModal,
    private toastrSvc: ToastrService,
    private readonly changeDetector: ChangeDetectorRef,
    private apiSvc: ApiService
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
          defaultValue: 0,
          props: {
            type: "number",
            required: true
          },
          expressions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "props.label": ( field: FormlyFieldConfig ) => {
              return field.model.payment_required ? "Price (GBP)" : "Suggested Donation (GBP)"
            }
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
          key: "featured_image",
          id: "featured_image",
          type: "input",
          props: {
            type: "file",
            label: "Featured Image",
            required: true
          }
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
          props: {
            label: "Policy",
            required: true,
            options: this.policies ( ).filter ( x => x.category === "Event Policy" ).map ( x => ( { label: x.title, value: x.id } ) )
          }
        },
        {
          key: "gdpr_id",
          type: "select",
          props: {
            label: "GDPR",
            required: true,
            options: this.policies ( ).filter ( x => x.category === "GDPR" ).map ( x => ( { label: x.title, value: x.id } ) )
          }
        }
      ]

      this.model = {
        payment_required: true
      }

      this.loading.set ( false )
    } )
  }

  public ngAfterViewChecked ( ) {
    this.changeDetector.detectChanges ( )
  }

  public submit ( ) {
    if ( this.storeFile ( "featured_image" ) ) {
      if ( this.storeFile ( "poster_link" ) ) {
        if ( this.storeFile ( "timetable_link" ) ) {
          if ( !this.model.date_to ) {
            this.model.date_to = ""
          }
          const fd = new FormData ( )
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
          this.apiSvc.request ( "/events.php", fd, "POST" ).then ( ( ) => {
            this.confirm.set ( true )
          } ).catch ( ( ) => {
            this.toastrSvc.error ( "Failed to Add Event" )
          } ).finally ( ( ) => {
            this.close ( )
          } )
        }
      }
    }
  }

  public getPolicies ( ) {
    return this.apiSvc.request ( "/policies.php" ).then ( ( res: any ) => {
      this.policies = res
    } ).catch ( e => {
      console.error ( e )
      this.toastrSvc.error ( "Failed to Load Policies" )
    } )
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
