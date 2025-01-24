import { CurrencyPipe } from "@angular/common"
import { Component, Input, OnInit } from "@angular/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-policy-edit",
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
  templateUrl: "./policy-edit.component.html"
} )
export class PolicyEditComponent implements OnInit {
  @Input ( ) public policy: any = ""

  public loading = true
  public faSpinner = faSpinner
  public confirm = false

  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]
  public model = { }

  public constructor (
    private apiSvc: HttpService,
    private activeModal: NgbActiveModal,
    private toastrSvc: ToastrService
  ) { }

  public ngOnInit ( ) {
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
          label: "Content",
          required: true
        }
      },
      {
        key: "category",
        type: "select",
        props: {
          label: "Category",
          options: this.policy.categories.split ( "," ).map ( ( x: any ) => ( { label: x, value: x } ) ),
          required: true
        }
      }
    ]

    this.model = {
      title: this.policy.title,
      description: this.policy.description,
      category: this.policy.category
    }
    this.loading = false
  }

  public submit ( ) {
    const to_update: any = {
      "id": this.policy.id,
      ...this.model
    }
    this.apiSvc.request ( "/policies.php", to_update, "POST" ).then ( ( res: any ) => {
      this.confirm = true
    } ).catch ( e => {
      this.toastrSvc.error ( e.error )
    } ).finally ( ( ) => {
      this.close ( )
    } )
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
