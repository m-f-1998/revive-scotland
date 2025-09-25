import { WritableSignal } from "@angular/core"
import { IconDefinition } from "@fortawesome/free-brands-svg-icons"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { Observable } from "rxjs"

export interface FormlyExpressions extends FormlyFieldConfig {
  className?: string
  expressions?:  Record<string, string | ( ( field: FormlyFieldConfig ) => any ) | Observable<any>>
  hooks?: Record<string, ( ( field: FormlyFieldConfig ) => void ) | Observable<void>>
  defaultValue?: any
  validators?: any
  fieldArray?: any
}

export interface FormlyProps {
  required?: boolean
  loading?: WritableSignal<boolean>
  error?: boolean
  label?: string
  type?: string
  minLength?: number
  maxLength?: number
  placeholder?: string
  disableNext?: boolean
  disablePrevious?: boolean
  procedureOnStart?: string
  procedureOnFinish?: string
  hidden?: boolean
  readonly?: boolean
  disabled?: boolean
  description?: string
  attributes?: Record<string, string|number>
  change?: ( control: FormlyFieldConfig ) => void // Equivalent to hook oncomplete rather than expression change
}

export interface FormlyText extends FormlyProps {
  minLength?: number
  rows?: number
  includeMaxDescription?: boolean
}

export interface FormlyDate extends FormlyProps {
  minDate?: Date
  maxDate?: Date
  startDate?: Date
}

export interface FormlyNumber extends FormlyProps {
  min?: number
  max?: number
  step?: number
}

export interface FormlySelect extends FormlyProps {
  options: {
    label: string
    value: string | number
    faClass?: IconDefinition
  } [ ] | Observable<{
    label: string
    value: string | number
    faClass?: IconDefinition
  } [ ]>
  multiple?: boolean
  clearable?: boolean
}
