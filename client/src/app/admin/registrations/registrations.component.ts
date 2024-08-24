import { Component } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faEye, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { AdminService } from "@services/AdminService.service"
import { HttpService } from "@services/HttpService.service"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { RegistrationViewComponent } from "../components/registration-view/registration-view.component"

@Component ( {
  selector: "app-admin-registrations",
  standalone: true,
  imports: [
    FaIconComponent,
    FormsModule,
    FormlyModule,
    ReactiveFormsModule
  ],
  templateUrl: "./registrations.component.html",
  styleUrl: "./registrations.component.scss"
} )
export class AdminRegistrationsComponent {
  public registrations: any[] = []
  public filter: any[] = []
  public loading = true

  public faView = faEye
  public faSpinner = faSpinner

  public form = new FormGroup ( { } )
  public model: any = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  public constructor (
    public adminService: AdminService,
    private httpSvc: HttpService,
    private ngModal: NgbModal
  ) {
    this.httpSvc.request ( "/registrations/get_all.php" ).then ( ( res: any ) => {
      this.registrations = res
      this.filter = res
      const eventTitles = [ ...new Set ( res.map ( ( x: any ) => x.event_title ) ) ]

      this.fields = [
        {
          key: "title",
          type: "select",
          props: {
            label: "Event Title",
            change: ( ) => this.applyFilter ( ),
            options: [
              { label: "", value: "" },
              ...eventTitles.map(title => ({ label: title, value: title }))
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
              this.model.paid = false
              return field.model.donation
            },
          }
        },
        {
          key: "donation",
          type: "checkbox",
          props: {
            change: ( ) => this.applyFilter ( ),
            label: "Donation",
          }
        }
      ]
      this.model = {
        donation: false,
        paid: false
      }

      this.loading = false
    } ).catch ( e => {
      console.error ( e )
      this.loading = false
    } )
  }

  public viewRegistration ( registration: any ) {
    const modalRef = this.ngModal.open ( RegistrationViewComponent, { "size": "lg" } )
    modalRef.componentInstance.registration = registration
  }

  public applyFilter ( ) {
    this.filter = this.registrations.filter ( ( x: any ) => {
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
    } )
  }
}
