import { AbstractControl, ValidationErrors } from "@angular/forms"
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core"
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common"
import { translations, dictionary as enDictionary } from "@zxcvbn-ts/language-en"
zxcvbnOptions.setOptions ( {
  translations: translations,
  graphs: adjacencyGraphs,
  dictionary: {
    ...dictionary,
    ...enDictionary
  }
} )

export const PasswordMatchValidator = ( control: AbstractControl ): ValidationErrors | null => {
  const password = control.get ( "NewPassword" )
  const confirmPassword = control.get ( "RepeatPassword" )

  if ( password && confirmPassword ) {
    if ( password.value !== confirmPassword.value  ) {
      confirmPassword.setErrors ( {
        ...confirmPassword.errors,
        PasswordMatch: {
          message: "Password Fields Do Not Match"
        }
      } )
    } else {
      if ( confirmPassword && confirmPassword.errors ) {
        delete confirmPassword.errors [ "PasswordMatch" ]
        if ( Object.keys ( confirmPassword.errors ).length === 0 ) {
          confirmPassword.setErrors ( null )
        }
      }
    }
  }
  return null
}

export const getPasswordWarnings = ( control: AbstractControl ) => {
  const value = control.value
  let suggestions: string [ ] = [ ]
  if ( value ) {
    const result = zxcvbn ( value )
    if ( result.score < 3 ) {
      suggestions = result.feedback.suggestions
    }
    if ( suggestions.length === 0 ) {
      return ""
    }
    return suggestions.map ( suggestion => {
      return `\n- ${suggestion}`
    } ).join ( "" )
  }
  return ""
}

const getPasswordErrors = ( control: AbstractControl, complex: boolean = true ) => {
  const value = control.value
  let suggestions: string [ ] = [ ]
  if ( value ) {
    const result = zxcvbn ( value )
    if ( !/[A-Z]/.test ( value ) ) {
      suggestions.push ( "Include an uppercase letter" )
    }
    if ( !/[a-z]/.test ( value ) ) {
      suggestions.push ( "Include a lowercase letter" )
    }
    if ( !/[0-9]/.test ( value ) ) {
      suggestions.push ( "Include a number" )
    }
    if ( !/[^A-Za-z0-9]/.test ( value ) ) {
      suggestions.push ( "Password must include a special character" )
    }
    if ( complex && result.score < 3 && suggestions.length === 0 ) {
      suggestions = result.feedback.suggestions
    }
    if ( suggestions.length === 0 ) {
      return ""
    }
    return suggestions.map ( suggestion => {
      return `\n- ${suggestion}`
    } ).join ( "" )
  }
  return ""
}

export const PasswordStrengthHigh = ( control: AbstractControl ): ValidationErrors | null => {
  const value = control.value
  if ( value ) {
    const errors = getPasswordErrors ( control )
    if ( errors ) {
      return {
        PasswordStrength: {
          message: `Password Strength Is Low. Please correct the following:${errors}`
        }
      }
    }
  }

  return null
}


export const PasswordStrengthBasic = ( control: AbstractControl ): ValidationErrors | null => {
  const value = control.value
  if ( value ) {
    const errors = getPasswordErrors ( control, false )
    if ( errors ) {
      return {
        PasswordStrength: {
          message: `Password Strength Is Low. Password must include the following:${errors}`
        }
      }
    }
  }

  return null
}