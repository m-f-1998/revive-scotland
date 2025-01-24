import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faEye, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { AdminService } from "@services/AdminService.service"
import { HttpService } from "@services/HttpService.service"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { RegistrationViewComponent } from "../components/registration-view/registration-view.component"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-registrations",
  imports: [
    FaIconComponent,
    FormsModule,
    FormlyModule,
    ReactiveFormsModule
  ],
  templateUrl: "./registrations.component.html",
  styleUrl: "./registrations.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdminRegistrationsComponent {
  public registrations: WritableSignal<any[]> = signal ( [ ] )
  public filter: WritableSignal<any[]> = signal ( [] )
  public loading: WritableSignal<boolean> = signal ( true )

  public faView = faEye
  public faSpinner = faSpinner

  public form = new FormGroup ( { } )
  public model: any = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  private eventTitles: WritableSignal<string[]> = signal ( [ ] )

  public constructor (
    public adminService: AdminService,
    private httpSvc: HttpService,
    private ngModal: NgbModal,
    private toastrSvc: ToastrService
  ) {
    this.httpSvc.request ( "/registrations/get_all.php" ).then ( ( res: any ) => {
      this.registrations = res
      this.filter = res
      this.eventTitles.set ( [ ...new Set ( res.map ( ( x: any ) => x.event_title ) ) ] as string [ ] )

      this.fields = [
        {
          key: "title",
          type: "select",
          props: {
            label: "Event Title",
            change: ( ) => this.applyFilter ( ),
            options: [
              { label: "", value: "" },
              ...this.eventTitles ( ).map ( title => ( { label: title, value: title } ) )
            ],
            required: false
          }
        },
        {
          key: "paid",
          type: "checkbox",
          props: {
            change: ( ) => this.applyFilter ( ),
            label: "Paid (Payment Required Only)",
          },
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              const onlyDonations = this.registrations ( ).every ( ( x: any ) => !x.payment_required )
              if ( onlyDonations ) {
                return true
              }
              this.filterTitles ( field )
              return false
            }
          }
        },
        {
          key: "donation",
          type: "checkbox",
          props: {
            change: ( ) => this.applyFilter ( ),
            label: "Donation",
          },
          expressions: {
            hide: ( field: FormlyFieldConfig ) => {
              const onlyPaid = this.registrations ( ).every ( ( x: any ) => x.payment_required )
              if ( onlyPaid ) {
                return true
              }
              this.filterTitles ( field )
              return false
            }
          }
        }
      ]
      this.model = {
        donation: false,
        paid: false
      }

      this.loading.set ( false )
    } ).catch ( e => {
      console.error ( e )
      this.loading.set ( false )
    } )
  }

  public filterTitles ( field: FormlyFieldConfig ) {
    const titleField = field.parent && field.parent.fieldGroup && field.parent.fieldGroup.find ( x => x.key === "title" )
    if ( titleField && titleField.props ) {
      titleField.props.options = [
        { label: "", value: "" },
        ...this.eventTitles ( ).map ( title => ( { label: title, value: title } ) )
      ].filter ( x => {
        if ( field.model.paid ) {
          const registration = this.registrations ( ).find ( ( y: any ) => y.event_title === x.value )
          if ( registration && !registration.payment_required ) return false
        }
        if ( field.model.donation ) {
          const registration = this.registrations ( ).find ( ( y: any ) => y.event_title === x.value )
          if ( registration && registration.payment_required ) return false
        }
        return true
      } )
      if ( titleField.props.options.length === 2 ) {
        titleField.props.options = [ titleField.props.options [ 1 ] ]
        titleField.model.title = titleField.props.options [ 0 ].value
      } else {
        titleField.model.title = ""
      }
    }
  }

  public updatePaid ( registration: any ) {
    if ( !confirm ( "Are you sure you want to update this registration's payment status?" ) ) return
    this.loading.set ( true )
    this.httpSvc.request ( "/registrations/post_update.php", {
      id: registration.id,
      paid: registration.paid ? 0 : 1
    }, "POST" ).then ( ( ) => {
      registration.paid = registration.paid ? 0 : 1
    } ).catch ( e => {
      console.error ( e )
      this.toastrSvc.error ( "There was an error updating the registration." )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public viewRegistration ( registration: any ) {
    const modalRef = this.ngModal.open ( RegistrationViewComponent, { "size": "lg" } )
    modalRef.componentInstance.registration = registration
  }

  public applyFilter ( ) {
    this.filter.set ( this.registrations ( ).filter ( ( x: any ) => {
      if ( this.model.paid ) {
        if ( !x.payment_required ) return false
        if ( !x.paid ) return false
      }
      if ( this.model.donation ) {
        if ( x.payment_required ) return false
      }
      if ( this.model.title ) {
        if ( x.event_title !== this.model.title ) return false
      }
      return true
    } ) )
  }
}
