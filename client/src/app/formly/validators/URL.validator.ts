import { AbstractControl, ValidationErrors } from "@angular/forms"

export const ValidWebPageURL = ( control: AbstractControl ): ValidationErrors | null => {
  const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w-./?%&=]*)?$/
  const value: string = control.value

  if ( !value ) {
    return null
  }

  if ( !urlPattern.test ( value ) ) {
    return { invalidURL: {
      message: "Please enter a valid URL."
    } }
  }

  return null
}