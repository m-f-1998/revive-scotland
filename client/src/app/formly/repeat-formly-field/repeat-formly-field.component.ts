import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { InputDialogComponent } from "../input-dialog/input-dialog.component"
import { FormlyService } from "../../services/formly.service"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { FieldType } from "@ngx-formly/bootstrap/form-field"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Component ( {
  selector: "app-repeat-formly-field",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./repeat-formly-field.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class RepeatFieldComponent extends FieldType {
  public editingIndex: number | null = null
  public valuesInModel: WritableSignal<any[]> = signal ( [ ] )

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  private fieldsCanAdd = [
    this.formlySvc.SelectInput ( "type", {
      label: "Field Type",
      options: [
        { label: "Text", value: "text" },
        { label: "Textarea", value: "textarea" },
        { label: "Checkbox", value: "checkbox" },
        { label: "Email", value: "email" },
        { label: "Phone", value: "phone" },
      ],
      required: true
    } ),
    this.formlySvc.TextInput ( "label", {
      label: "Field Label",
      required: true
    } ),
    this.formlySvc.TextInput ( "placeholder", {
      label: "Field Placeholder",
    }, {
      expressions: {
        hide: ( formlyField: FormlyFieldConfig ) => formlyField.model.type === "checkbox"
      }
    } ),
    this.formlySvc.CheckboxInput ( "required", {
      label: "Required?",
    } )
  ]

  public constructor ( ) {
    super ( )
  }

  public addField (  ) {
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.componentInstance.title = "Add New Item"
    modalRef.componentInstance.fields = this.fieldsCanAdd || [ ]
    modalRef.result.then ( ( result: { label: string; type: string; placeholder?: string; required?: boolean } ) => {
      if ( result ) {
        this.addNewFieldToModel ( this.formControl?.value?.length || 0, result )
      }
    } ).catch ( ( ) => { } ).finally ( ( ) => {
      modalRef.componentInstance.form.reset ( )
      modalRef.componentInstance.model = { }
    } )
  }

  public edit ( index: number ) {
    const fieldToEdit = this.formControl?.value?. [ index ]
    if ( !fieldToEdit ) {
      this.toastrSvc.error ( "Field to edit not found." )
      return
    }
    const modalRef = this.modalSvc.open ( InputDialogComponent, {
      centered: true
    } )
    modalRef.componentInstance.title = "Edit Item"
    modalRef.componentInstance.fields = this.fieldsCanAdd || [ ]
    modalRef.componentInstance.model = {
      required: fieldToEdit?.props?.required || false,
      label: fieldToEdit?.props?.label || "",
      placeholder: fieldToEdit?.props?.placeholder || "",
      type: fieldToEdit?.props?.type || fieldToEdit?.type || ""
    }
    modalRef.result.then ( ( result: { label: string; type: string; placeholder?: string; required?: boolean } ) => {
      if ( result ) {
        this.addNewFieldToModel ( index, result )
      }
    } ).catch ( ( ) => { } )
  }

  public removeField ( index: number ) {
    const newValue = ( this.formControl?.value || [ ] ).filter ( ( _: any, i: number ) => i !== index )
    this.formControl?.setValue ( newValue )
    this.valuesInModel.set ( newValue )
  }

  public getSummary ( field: FormlyFieldConfig ) {
    // Build a simple summary string from your field data
    const label = field?.props?.label || "Unnamed"
    const type = field?.props?.type || field?.type || "unknown"
    return `${label} (${type})`
  }

  private addNewFieldToModel ( index: number, fieldData: { label: string; type: string; placeholder?: string; required?: boolean } ) {
    let field: FormlyFieldConfig = { }
    const timestamp = new Date ( ).getTime ( )
    switch ( fieldData.type ) {
      case "text":
        field = this.formlySvc.TextInput (
          "repeat-text-" + timestamp,
          {
            label: fieldData.label,
            placeholder: fieldData.placeholder || "",
            required: fieldData.required || false
          }
        )
        break
      case "textarea":
        field = this.formlySvc.TextAreaInput (
          "repeat-textarea-" + timestamp,
          {
            label: fieldData.label,
            placeholder: fieldData.placeholder || "",
            required: fieldData.required || false
          }
        )
        break
      case "checkbox":
        field = this.formlySvc.CheckboxInput (
          "repeat-checkbox-" + timestamp,
          {
            label: fieldData.label,
            required: fieldData.required || false
          }
        )
        break
      case "email":
        field = this.formlySvc.EmailInput (
          "repeat-email-" + timestamp,
          {
            label: fieldData.label,
            placeholder: fieldData.placeholder || "",
            required: fieldData.required || false
          }
        )
        break
      case "phone":
        field = this.formlySvc.TelInput (
          "repeat-phone-" + timestamp,
          {
            label: fieldData.label,
            placeholder: fieldData.placeholder || "",
            required: fieldData.required || false
          }
        )
        break
    }
    const currentValue = [
      ...this.formControl?.value || [ ]
    ]
    if ( currentValue [ index ] ) {
      currentValue [ index ] = field
    } else {
      currentValue.splice ( index, 0, field )
    }
    this.formControl?.setValue ( currentValue )
    this.valuesInModel.set ( [
      ...currentValue
    ] )
  }
}
