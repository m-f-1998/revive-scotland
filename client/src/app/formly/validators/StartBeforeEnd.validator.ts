import { AbstractControl, ValidationErrors } from "@angular/forms"

export const StartBeforeEnd = ( control: AbstractControl ): ValidationErrors | null => {
  const startVal = control.value?.startDate
  const endVal = control.value?.endDate

  if ( !startVal || !endVal ) {
    return null
  }

  const start = new Date ( startVal )
  const end = new Date ( endVal )

  const startTime = String ( control.value?.startTime || "00:00" )
  const endTime = String ( control.value?.endTime || "00:00" )

  const startParts = startTime.split ( ":" ).map ( Number )
  const endParts = endTime.split ( ":" ).map ( Number )

  start.setHours ( startParts [ 0 ] || 0, startParts [ 1 ] || 0, 0, 0 )
  end.setHours ( endParts [ 0 ] || 0, endParts [ 1 ] || 0, 0, 0 )

  return start < end ? null : { StartBeforeEnd: { message: "End date and time must be after the start date and time." } }
}