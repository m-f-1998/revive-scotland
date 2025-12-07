import { Injectable } from "@angular/core"
import { ConfigOption, FormlyFieldConfig } from "@ngx-formly/core"
import { ValidPhoneNumber } from "./validators/PhoneNumber.validator"
import { ValidEmail } from "./validators/EmailAddress.validator"
import { ValidDate } from "./validators/Date.validator"
import { DatePickerComponent } from "./date-picker/date-picker.component"
import { AddressAutocompleteComponent } from "./address-lookup/address-lookup.component"
import { ValidWebPageURL } from "./validators/URL.validator"
import { ImagePickerComponent } from "./image-picker/image-picker.component"
import { RepeatFieldComponent } from "./repeat-formly-field/repeat-formly-field.component"

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
      name: "address-autocomplete",
      component: AddressAutocompleteComponent,
      extends: "input"
    },
    {
      name: "image-picker",
      component: ImagePickerComponent,
      extends: "input"
    },
    {
      name: "repeat",
      component: RepeatFieldComponent,
    }
  ]

  public validationMessages = [
    { name: "required", message: "This Field is Required" },
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
    { name: "ValidPhoneNumber", validation: ValidPhoneNumber },
    { name: "ValidDate", validation: ValidDate },
    { name: "ValidWebPageURL", validation: ValidWebPageURL }
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