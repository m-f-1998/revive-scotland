import { AbstractControl, ValidationErrors } from "@angular/forms"

export const ValidEmail = ( control: AbstractControl ): ValidationErrors | null => {
  const validRegex =
    /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

  const raw = control.value
  if ( raw == null || raw === "" || ( typeof raw === "string" && !raw.trim ( ) ) ) {
    return null
  }
  if ( typeof raw !== "string" ) {
    return { ValidEmail: { message: "Please Specify a Valid Email" } }
  }

  if ( raw.trim ( ).match ( validRegex ) ) {
    return null
  }

  return { ValidEmail: { message: "Please Specify a Valid Email" } }
}