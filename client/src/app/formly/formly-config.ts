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
import { FormlyWrapperFormFieldComponent } from "./types/form-field.wrapper"
import { FormlyFieldInputComponent } from "./types/input.type"
import { FormlyFieldSelectComponent } from "./types/select.type"
import { FormlyFieldTextareaComponent } from "./types/textarea.type"
import { FormlyFieldCheckboxComponent } from "./types/checkbox.type"

@Injectable ( {
  providedIn: "root"
} )
export class FormlyConfig implements ConfigOption {
  public types = [
    {
      name: "input",
      component: FormlyFieldInputComponent,
      wrappers: [ "form-field" ]
    },
    {
      name: "select",
      component: FormlyFieldSelectComponent,
      wrappers: [ "form-field" ]
    },
    {
      name: "textarea",
      component: FormlyFieldTextareaComponent,
      wrappers: [ "form-field" ]
    },
    {
      name: "checkbox",
      component: FormlyFieldCheckboxComponent,
    },
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

  public wrappers = [
    {
      name: "form-field",
      component: FormlyWrapperFormFieldComponent
    }
  ]

  public validationMessages = [
    { name: "required", message: "This Field is Required" },
    { name: "minLength", message: ( _: unknown, field: FormlyFieldConfig ) => {
      return `Should have a minimum of ${field.props?.minLength ?? 0} characters.`
    } },
    { name: "maxLength", message: ( _: unknown, field: FormlyFieldConfig ) => {
      return `Should have a maximum of ${field.props?.maxLength ?? 0} characters.`
    } },
    { name: "min", message: ( _: unknown, field: FormlyFieldConfig ) => {
      return `Minimum value is ${field.props?.min ?? 0}.`
    } },
    { name: "max", message: ( _: unknown, field: FormlyFieldConfig ) => {
      return `Maximum value is ${field.props?.max ?? 0}.`
    } },
    { name: "PasswordsDoNotMatch", message: "The 'New Password' field cannot match the 'Current Password' field" },
    { name: "invalidClassName", message: "Invalid Class Name" },
    { name: "invalidFormID", message: "Invalid Form ID" },
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