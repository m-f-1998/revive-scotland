import { AbstractControl, ValidationErrors } from '@angular/forms'

export function ValidEmail(control: AbstractControl): ValidationErrors | null {
  // eslint-disable-next-line max-len
  const validRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/

  if ( control.value?.match ( validRegex ) ) {
    return null
  }

  return { ValidEmail: { message: 'Please Specify a Valid Email' } }
}