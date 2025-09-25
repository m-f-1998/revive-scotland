import { Injectable } from "@angular/core"
import { FormlyFieldConfig } from "@ngx-formly/core"
import {
  FormlyDate,
  FormlyExpressions,
  FormlyNumber,
  FormlyProps,
  FormlySelect,
  FormlyText,
} from "../formly/formly-types"
// import { FormGroup } from "@angular/forms"
// import { parse } from "postcode"

@Injectable ( {
  providedIn: "root"
} )
export class FormlyService {
  public TextInput (
    key: string,
    props: FormlyText = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    if ( !props.maxLength ) props.maxLength = 250
    if ( !props.minLength ) props.minLength = 0
    if ( !!props.includeMaxDescription ) {
      expressions.expressions = {
        ...expressions.expressions,
        "props.description": config => {
          const currentLength = ( ( config.model [ key ] ?? "" ).toString ( ) ?? [ ] ).length
          const maxLength = config.props?.maxLength || 0
          return `${currentLength}/${maxLength} characters used`
        }
      }
    }
    return this.Input ( key, "text", props, expressions, focus )
  }

  public EmailInput ( key: string, props: FormlyProps = { }, expressions: FormlyExpressions = { }, focus: boolean = false ): FormlyFieldConfig {
    expressions.validators = {
      validation: [ "ValidEmail" ]
    }
    return this.Input ( key, "email", props, expressions, focus )
  }

  public PasswordInput (
    key: string,
    props: FormlyProps = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    if ( !props.maxLength ) {
      props.maxLength = 250
    }
    props.minLength = props.minLength || 8
    return this.CustomField ( key, "password", { ...expressions, props }, focus )
  }

  public NumberInput (
    key: string,
    props: FormlyNumber = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    if ( !expressions.defaultValue ) expressions.defaultValue = 0
    return this.Input ( key, "number", props, expressions, focus )
  }

  public CheckboxInput (
    key: string,
    props: FormlyProps = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    if ( !expressions.defaultValue ) expressions.defaultValue = false
    return this.CustomField ( key, "checkbox", { ...expressions, props }, focus )
  }

  public TextAreaInput (
    key: string,
    props: FormlyText = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    return this.CustomField ( key, "textarea", { ...expressions, props }, focus )
  }

  public DateInput ( key: string, props: FormlyDate = { }, expressions: FormlyExpressions = { }, focus: boolean = false ): FormlyFieldConfig {
    expressions.validators = {
      validation: [ "ValidDate" ]
    }
    expressions.name = key
    return this.CustomField ( key, "datepicker", { ...expressions, props }, focus )
  }

  public TimePickerInput (
    key: string,
    props: FormlyProps = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    return this.CustomField ( key, "timepicker", { ...expressions, props }, focus )
  }

  public LocationInput (
    key: string,
    props: FormlyProps = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    return this.CustomField ( key, "locationpicker", { ...expressions, props }, focus )
  }

  public FileInput ( key: string, props: FormlyProps = { }, expressions: FormlyExpressions = { } ): FormlyFieldConfig {
    // NOTE: Attributes for File Input:
    // - maxSize: Maximum size of the file in MB
    // - accept: Comma separated list of MIME types
    return this.CustomField ( key, "file", { ...expressions, props, } )
  }

  public Select (
    key: string,
    props: FormlySelect = { options: [ ] },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    return this.CustomField ( key, "select", { ...expressions, props }, focus )
  }

  // Radio Buttons
  public Radio (
    key: string,
    props: FormlySelect = { options: [ ] },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    return this.CustomField ( key, "radio", { ...expressions, props }, focus )
  }

  private Input (
    key: string,
    type: string,
    props: FormlyProps,
    expressions: FormlyExpressions,
    focus: boolean = false
  ): FormlyFieldConfig {
    props.type = type
    return {
      key,
      id: key,
      type: "input",
      props,
      focus,
      ...expressions
    }
  }

  private CustomField ( key: string, type: string, expressions: FormlyExpressions, focus: boolean = false ): FormlyFieldConfig {
    return {
      id: key,
      key,
      type,
      focus,
      ...expressions
    }
  }
}