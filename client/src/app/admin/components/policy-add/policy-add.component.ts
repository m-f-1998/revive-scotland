import { AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, signal, WritableSignal } from "@angular/core"
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"

@Component ( {
  selector: "app-admin-policy-add",
  imports: [
    FaIconComponent,
    ReactiveFormsModule,
    FormsModule,
    FormlyModule
  ],
  templateUrl: "./policy-add.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PolicyAddComponent implements OnInit, AfterViewChecked {
  @Input ( ) public categories: any = ""

  public loading: WritableSignal<boolean> = signal ( true )
  public faSpinner = faSpinner
  public confirm: WritableSignal<boolean> = signal ( false )

  public form = new FormGroup ( { } )
  public fields: FormlyFieldConfig [ ] = [ ]
  public model = { }

  public constructor (
    private apiSvc: HttpService,
    private activeModal: NgbActiveModal,
    private toastrSvc: ToastrService,
    public changeDetectorRef: ChangeDetectorRef
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
          options: this.categories.split ( "," ).map ( ( x: any ) => ( { label: x, value: x } ) ),
          required: true
        }
      }
    ]

    this.loading.set ( false )
  }

  public ngAfterViewChecked ( ) {
    this.changeDetectorRef.detectChanges ( )
  }

  public submit ( ) {
    this.loading.set ( true )

    this.apiSvc.request ( "/policies.php", this.model, "POST" ).then ( ( ) => {
      this.toastrSvc.success ( "Policy Created Successfully" )
      this.close ( )
    } ).catch ( e => {
      this.toastrSvc.error ( e.error )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
