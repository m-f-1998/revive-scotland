import { WritableSignal } from "@angular/core"
import { AbstractControl } from "@angular/forms"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { Observable } from "rxjs"

export interface FormlyExpressions extends FormlyFieldConfig {
  className?: string
  expressions?:  Record<string, string | ( ( field: FormlyFieldConfig ) => unknown ) | Observable<unknown>>
  hooks?: Record<string, ( ( field: FormlyFieldConfig ) => void ) | Observable<void>>
  defaultValue?: unknown
  validators?: { validation: string [ ] } | { [ key: string ]: { message: ( ) => string; expression: ( x: AbstractControl ) => boolean } }
  fieldArray?: FormlyFieldConfig | ( ( field: FormlyFieldConfig ) => FormlyFieldConfig )
}

// Object literal may only specify known properties, and 'expression' does not exist in type '(control: AbstractControl<any, any, any>, field: FormlyFieldConfig<FormlyFieldProps & { [additionalProperties: string]: any; }>) => ValidationErrors | null'.ts(2353)
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
  options?: Array<{ label: string; value: unknown }>
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
}