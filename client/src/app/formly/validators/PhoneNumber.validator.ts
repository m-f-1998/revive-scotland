import { AbstractControl, ValidationErrors } from "@angular/forms"

export const ValidPhoneNumber = ( control: AbstractControl ): ValidationErrors | null => {
  if ( control.value === null || control.value === "" ) {
    return null
  }

  if ( control.value && !String ( control.value ).match ( "^[0-9 ]*$" ) ) {
    return { ValidPhoneNumber: { message: "Phone Number is not Valid" } }
  } else {
    return null
  }
}