import { WritableSignal } from "@angular/core"
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
  maxLength?: number
  placeholder?: string
  disableNext?: boolean
  disablePrevious?: boolean
  options?: Array<{ label: string; value: any }>
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
  minDate?: string
  maxDate?: string
}