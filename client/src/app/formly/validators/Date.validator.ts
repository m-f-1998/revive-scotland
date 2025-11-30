import { AbstractControl, ValidationErrors } from "@angular/forms"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { format } from "date-fns"

export const ValidDate = ( control: AbstractControl, field: FormlyFieldConfig ): ValidationErrors | null => {
  if ( !control.value ) {
    return null
  }

  if ( !field.props?. [ "minDate" ] && !field.props?. [ "maxDate" ] ) {
    return null
  }

  // Normalise times to midnight for accurate comparison
  const startOfDay = ( date: Date ) => {
    return new Date ( date ).setHours ( 0, 0, 0, 0 )
  }

  const endOfDay = ( date: Date ) => {
    return new Date ( date ).setHours ( 23, 59, 59, 999 )
  }

  if ( field.props?. [ "minDate" ] && startOfDay ( control.value ) < startOfDay ( field.props [ "minDate" ] ) ) {
    return { minDate: { message: "Date must be after " + format ( field.props [ "minDate" ], "dd/MM/yyyy" ) } }
  }

  if ( field.props?. [ "maxDate" ] && endOfDay ( control.value ) > endOfDay ( field.props [ "maxDate" ] ) ) {
    return { maxDate: { message: "Date must be before " + format ( field.props [ "maxDate" ], "dd/MM/yyyy" ) } }
  }

  return null
}