import { Injectable } from "@angular/core"
import { FormlyFieldConfig } from "@ngx-formly/core"
import {
  FormlyExpressions,
  FormlyProps,
  FormlyText,
} from "../formly/formly-types"

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

  public SelectInput (
    key: string,
    props: FormlyProps = { },
    expressions: FormlyExpressions = { },
    focus: boolean = false
  ): FormlyFieldConfig {
    if ( !props.options ) props.options = [ ]
    return this.CustomField ( key, "select", { ...expressions, props }, focus )
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