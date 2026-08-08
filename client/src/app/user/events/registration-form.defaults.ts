import { FormlyFieldConfig } from "@ngx-formly/core"
import { FormlyService } from "@services/formly.service"

/** Sensible defaults for registration forms — Name, Email, Phone with stable keys. */
export const getDefaultRegistrationFields = ( formlySvc: FormlyService ): FormlyFieldConfig [ ] => [
  formlySvc.TextInput ( "name", {
    label: "Full Name",
    placeholder: "Your full name",
    required: true
  } ),
  formlySvc.EmailInput ( "email", {
    label: "Email",
    placeholder: "you@example.com",
    required: true
  } ),
  formlySvc.TelInput ( "phone", {
    label: "Phone",
    placeholder: "07XXX XXXXXX",
    required: false
  } )
]
