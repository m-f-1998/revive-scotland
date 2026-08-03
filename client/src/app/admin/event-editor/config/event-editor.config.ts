import { FormlyFieldConfig } from "@ngx-formly/core"
import { FormlyService } from "../../../services/formly.service"

export const getEventFields = ( formlySvc: FormlyService ): FormlyFieldConfig [ ] => {
  return [
    formlySvc.TextInput ( "title", {
      label: "Event Title",
      placeholder: "Enter event title",
      required: true,
      maxLength: 100,
      includeMaxDescription: true
    }, { } ),
    formlySvc.TextAreaInput ( "description", {
      label: "Event Description",
      placeholder: "Enter event description",
      required: true,
      maxLength: 500,
      includeMaxDescription: true
    }, { } ),
    formlySvc.AddressAutocompleteInput ( "location", {
      label: "Event Location",
      required: true,
      maxLength: 200
    }, { } ),
    formlySvc.DateInput ( "startDate", {
      label: "Start Date",
      placeholder: "Select start date",
      required: true,
      minDate: new Date ( )
    }, { } ),
    formlySvc.TimeInput ( "startTime", {
      label: "Start Time",
      placeholder: "19:00",
      required: false
    }, { } ),
    formlySvc.DateInput ( "endDate", {
      label: "End Date",
      placeholder: "Select end date",
      required: true,
      minDate: new Date ( )
    }, { } ),
    formlySvc.TimeInput ( "endTime", {
      label: "End Time",
      placeholder: "21:00",
      required: false
    }, { } ),
    formlySvc.ImagePickerInput ( "imageUrl", {
      label: "Event Image",
      required: true
    }, { } ),
    formlySvc.SelectInput ( "actionType", {
      label: "Registration Type",
      options: [
        { label: "External Link", value: "webpage" },
        { label: "Registration Form", value: "contact" }
      ],
      required: true
    }, {
      defaultValue: "webpage"
    } ),
    formlySvc.TextInput ( "webpageUrl", {
      label: "External URL",
      placeholder: "Enter the external registration URL"
    }, {
      validators: {
        validation: [ "ValidWebPageURL" ]
      },
      expressions: {
        "props.required": ( formlyField: FormlyFieldConfig ) => formlyField.model?.actionType === "webpage",
        hide: ( formlyField: FormlyFieldConfig ) => formlyField.model?.actionType !== "webpage"
      }
    } ),
    {
      key: "contactFormFields",
      type: "repeat",
      props: {
        addText: "Add Field",
      },
      expressions: {
        "props.required": ( formlyField: FormlyFieldConfig ) => ( formlyField.form?.value || { } ).actionType === "contact",
        hide: ( formlyField: FormlyFieldConfig ) => ( formlyField.form?.value || { } ).actionType !== "contact"
      }
    },
    formlySvc.SelectInput ( "donationRequired", {
      label: "Donation Status",
      options: [
        { label: "No Donation", value: "none" },
        { label: "Optional Donation", value: "optional" },
        { label: "Required Donation", value: "required" }
      ],
      required: false
    }, {
      defaultValue: "none",
      expressions: {
        hide: ( formlyField: FormlyFieldConfig ) => ( formlyField.form?.value || { } ).actionType !== "contact"
      }
    } ),
    formlySvc.TextAreaInput ( "donationDescription", {
      label: "Donation Description",
      placeholder: "Enter description for the donation step",
      required: false,
      maxLength: 500
    }, {
      expressions: {
        hide: "model.donationRequired === 'none' || !model.donationRequired || model.actionType !== 'contact'"
      }
    } ),
    {
      ...formlySvc.TextInput ( "donationPrice", {
        label: "Donation Price (£)",
        placeholder: "10.00",
        required: false,
        type: "number",
        attributes: {
          min: "0.50",
          step: "0.01"
        }
      }, {
        expressions: {
          hide: "model.donationRequired === 'none' || !model.donationRequired || model.actionType !== 'contact'",
          "props.required": "model.donationRequired !== 'none' && model.donationRequired"
        }
      } )
    }
  ]
}
