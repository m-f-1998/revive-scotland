import { Injectable } from "@angular/core"
import { ConfigOption, FormlyFieldConfig } from "@ngx-formly/core"
import { ValidEmail } from "./validators/EmailAddress.validator"
import { ValidPhoneNumber } from "./validators/PhoneNumber.validator"
import { PasswordComponent } from "./password/password.component"
import { DatePickerComponent } from "./date-picker/date-picker.component"
import { TimePickerComponent } from "./time-picker/time-picker.component"
import { LocationPickerComponent } from "./location-picker/location-picker.component"
import { FileInputComponent } from "./files/file-input.component"

@Injectable ( {
  providedIn: "root"
} )
export class FormlyConfig implements ConfigOption {
  public types = [
    {
      name: "datepicker",
      component: DatePickerComponent,
      extends: "input"
    },
    {
      name: "timepicker",
      component: TimePickerComponent,
      extends: "input"
    },
    {
      name: "locationpicker",
      component: LocationPickerComponent,
      extends: "input"
    },
    {
      name: "password",
      component: PasswordComponent,
      extends: "input"
    },
    {
      name: "file",
      component: FileInputComponent,
      extends: "input"
    }
  ]

  public validationMessages = [
    { name: "required", message: "This field is Required" },
    { name: "minLength", message: ( _: any, field: FormlyFieldConfig ) => {
      return `Should have a minimum of ${field.props?.minLength ?? 0} characters.`
    } },
    { name: "maxLength", message: ( _: any, field: FormlyFieldConfig ) => {
      return `Should have a maximum of ${field.props?.maxLength ?? 0} characters.`
    } },
    { name: "min", message: ( _: any, field: FormlyFieldConfig ) => {
      return `Minimum value is ${field.props?.min ?? 0}.`
    } },
    { name: "max", message: ( _: any, field: FormlyFieldConfig ) => {
      return `Maximum value is ${field.props?.max ?? 0}.`
    } },
    { name: "PasswordsDoNotMatch", message: "The 'New Password' field cannot match the 'Current Password' field" },
    { name: "invalidClassName", message: "Invalid Class Name" },
    { name: "invalidFormID", message: "Invalid Form ID" },
    { name: "ngbDate", message: "Invalid Date" },
  ]

  public validators = [
    { name: "ValidEmail", validation: ValidEmail },
    { name: "ValidPhoneNumber", validation: ValidPhoneNumber }
  ]

  public extras = {
    lazyRender: false,
    resetFieldOnHide: false,
    showError: ( field: FormlyFieldConfig ) => {
      if ( field.formControl?.dirty ) {
        return  field.formControl?.invalid && ( field.formControl?.touched || field.formControl?.value )
      } else {
        return false
      }
    }
  }
}