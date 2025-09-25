import { inject } from "@angular/core"
import { FormlyService } from "../../services/formly.service"
import { FormlyField, FormlyFieldConfig } from "@ngx-formly/core"

export const getEventFields = ( ): Array<FormlyFieldConfig|FormlyField> => {
  const formlySvc = inject ( FormlyService )

  return [
    formlySvc.TextInput ( "title", {
      label: "Title",
      required: true,
      maxLength: 50
    } ),
    formlySvc.TextAreaInput ( "description", {
      label: "Description"
    } ),
    {
      formClassName: "d-flex gap-3",
      formGroup: [
        formlySvc.DateInput ( "start_date", {
          label: "Event Start Date"
        } ),
        formlySvc.TimePickerInput ( "start_time", {
          label: "Event Start Time"
        } )
      ]
    },
    {
      formClassName: "d-flex gap-3",
      formGroup: [
        formlySvc.DateInput ( "end_date", {
          label: "Event End Date"
        } ),
        formlySvc.TimePickerInput ( "end_time", {
          label: "Event End Time"
        } )
      ]
    },
    formlySvc.LocationInput ( "location" ),
    formlySvc.FileInput ( "showcase_image", {
      label: "Showcase Image",
      attributes: {
        "accept": "image/*"
      }
    } ),
    formlySvc.CheckboxInput ( "donation_requested", {
      label: "Is a donation requested for this event?",
      hidden: true
    }, {
      expressions: {
        hide: () => {
          return true
        }
      }
    } ),
    formlySvc.NumberInput ( "donation_amount", {
      label: "Requested Donation Amount (in GBP)",
      min: 0,
      step: 0.01
    }, {
      expressions: {
        hide: ( field: FormlyFieldConfig ) => {
          return !field.model?.donation_requested
        }
      }
    } ),
    formlySvc.CheckboxInput ( "payment_required", {
      label: "Is payment required for this event?"
    }, {
      expressions: {
        hide: () => {
          return true
        }
      }
    } ),
    formlySvc.NumberInput ( "payment_amount", {
      label: "Payment Amount (in GBP)",
      min: 0,
      step: 0.01
    }, {
      expressions: {
        "props.hidden": ( field: FormlyFieldConfig ) => {
          return !field.model?.payment_required
        }
      }
    } ),
    formlySvc.Radio ( "action", {
      label: "What do you want to do?",
      options: [
        {
          label: "Go To External Link",
          value: "external_link"
        },
        {
          label: "Complete Registration Form",
          value: "registration_form"
        }
      ]
    } ),
    formlySvc.TextInput ( "action_url", {
      label: "Action URL",
      placeholder: "https://example.com"
    }, {
      expressions: {
        hide: ( field: FormlyFieldConfig ) => {
          return !field.model?.action
        }
      }
    } )
  ]
}