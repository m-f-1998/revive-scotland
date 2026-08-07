import { FormlyFieldConfig } from "@ngx-formly/core"
import { FormlyService } from "@services/formly.service"
import { getDefaultRegistrationFields } from "../../../user/events/registration-form.defaults"

export { getDefaultRegistrationFields }

const sectionHeader = ( title: string ): FormlyFieldConfig => ( {
  template: `<h6 class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mt-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-700">${title}</h6>`
} )

export const getEventFields = ( formlySvc: FormlyService, eventModel?: Record<string, unknown> ): FormlyFieldConfig [ ] => {
  const isFinished = eventModel?. [ "endDate" ] ? ( new Date ( eventModel [ "endDate" ] as string | Date ) < new Date ( ) ) : false

  const minStart = eventModel?. [ "startDate" ] && new Date ( eventModel [ "startDate" ] as string | Date ) < new Date ( )
    ? new Date ( eventModel [ "startDate" ] as string | Date )
    : new Date ( )

  const minEnd = eventModel?. [ "endDate" ] && new Date ( eventModel [ "endDate" ] as string | Date ) < new Date ( )
    ? new Date ( eventModel [ "endDate" ] as string | Date )
    : new Date ( )

  const fields: FormlyFieldConfig [ ] = [
    sectionHeader ( "Basics" ),
    formlySvc.TextInput ( "title", {
      label: "Event Title",
      placeholder: "Enter event title",
      required: true,
      maxLength: 100,
      includeMaxDescription: true
    }, { } ),
    formlySvc.TextAreaInput ( "description", {
      label: "Summary (shown on event card)",
      placeholder: "Short summary for the event listing card",
      required: true,
      maxLength: 500,
      includeMaxDescription: true
    }, { } ),
    formlySvc.TextAreaInput ( "longDescription", {
      label: "Full description (shown when expanded)",
      placeholder: "Optional longer description with full event details",
      maxLength: 5000,
      includeMaxDescription: true
    }, { } ),

    sectionHeader ( "When & where" ),
    formlySvc.AddressAutocompleteInput ( "location", {
      label: "Event Location",
      required: true,
      maxLength: 200
    }, { } ),
    {
      fieldGroup: [
        {
          fieldGroupClassName: "grid grid-cols-1 md:grid-cols-2 gap-4",
          fieldGroup: [
            formlySvc.DateInput ( "startDate", {
              label: "Start Date",
              placeholder: "Select start date",
              required: true,
              minDate: minStart
            }, { } ),
            formlySvc.TimeInput ( "startTime", {
              label: "Start Time",
              placeholder: "19:00"
            }, { } )
          ]
        },
        {
          fieldGroupClassName: "grid grid-cols-1 md:grid-cols-2 gap-4",
          fieldGroup: [
            formlySvc.DateInput ( "endDate", {
              label: "End Date",
              placeholder: "Select end date",
              required: true,
              minDate: minEnd
            }, { } ),
            formlySvc.TimeInput ( "endTime", {
              label: "End Time",
              placeholder: "21:00"
            }, { } )
          ]
        }
      ],
      validators: {
        validation: [ "StartBeforeEnd" ]
      }
    },

    sectionHeader ( "Media" ),
    formlySvc.ImagePickerInput ( "imageUrl", {
      label: "Event Image",
      required: true
    }, { } ),

    sectionHeader ( "Registration" ),
    {
      fieldGroupClassName: "grid grid-cols-1 md:grid-cols-2 gap-4",
      fieldGroup: [
        formlySvc.SelectInput ( "actionType", {
          label: "Registration Type",
          options: [
            { label: "External Link", value: "webpage" },
            { label: "Registration Form", value: "form" }
          ],
          required: true
        }, {
          expressions: {
            "props.description": ( _: FormlyFieldConfig ) => {
              if ( eventModel?. [ "id" ] && String ( eventModel [ "id" ] ).includes ( "event-" ) ) {
                return "Type cannot be changed after creation."
              }
              return undefined
            },
            "props.disabled": ( _: FormlyFieldConfig ) => {
              return eventModel?. [ "id" ] && String ( eventModel [ "id" ] ).includes ( "event-" )
            },
          },
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
        } )
      ]
    },
    {
      key: "contactFormFields",
      type: "repeat",
      defaultValue: getDefaultRegistrationFields ( formlySvc ),
      props: {
        addText: "Add Field",
        description: "Starts with Full Name, Email, and Phone. Add extra fields as needed."
      },
      expressions: {
        "props.required": ( formlyField: FormlyFieldConfig ) => formlyField.model?.actionType === "form",
        hide: ( formlyField: FormlyFieldConfig ) => formlyField.model?.actionType !== "form"
      }
    },

    sectionHeader ( "Donations & capacity" ),
    {
      fieldGroupClassName: "grid grid-cols-1 md:grid-cols-2 gap-4",
      expressions: {
        hide: ( formlyField: FormlyFieldConfig ) => formlyField.model?.actionType !== "form"
      },
      fieldGroup: [
        formlySvc.SelectInput ( "donationRequired", {
          label: "Donation Status",
          options: [
            { label: "No Donation", value: "none" },
            { label: "Optional Donation", value: "optional" },
            { label: "Required Donation", value: "required" }
          ]
        }, {
          defaultValue: "none"
        } ),
        {
          ...formlySvc.TextInput ( "donationPrice", {
            label: "Donation Price (£)",
            placeholder: "10.00",
            type: "number",
            attributes: {
              min: "0.50",
              step: "0.01"
            }
          }, {
            expressions: {
              hide: ( config: FormlyFieldConfig ) => config.model.donationRequired === "none" || !config.model.donationRequired,
              "props.required": ( config: FormlyFieldConfig ) => config.model?.donationRequired !== "none" && !!config.model?.donationRequired
            }
          } )
        }
      ]
    },
    formlySvc.TextAreaInput ( "donationDescription", {
      label: "Donation Description",
      placeholder: "Enter description for the donation step",
      maxLength: 500
    }, {
      expressions: {
        hide: ( config: FormlyFieldConfig ) => config.model.donationRequired === "none" || !config.model.donationRequired || config.model.actionType !== "form"
      }
    } ),
    {
      fieldGroupClassName: "grid grid-cols-1 md:grid-cols-2 gap-4",
      expressions: {
        hide: ( formlyField: FormlyFieldConfig ) => formlyField.model?.actionType !== "form"
      },
      fieldGroup: [
        formlySvc.TextInput ( "maxAttendees", {
          label: "Max attendees (optional)",
          placeholder: "Leave empty for unlimited",
          type: "number",
          attributes: { min: "1", step: "1" },
          description: "Confirmed registrations only. Leave blank for no limit."
        }, { } ),
        formlySvc.CheckboxInput ( "waitlistEnabled", {
          label: "Enable waitlist when full",
          description: "Free registrations join a waitlist instead of being rejected."
        }, {
          defaultValue: false
        } )
      ]
    }
  ]

  if ( isFinished ) {
    const disableRecursively = ( fList: FormlyFieldConfig [ ] ) => {
      fList.forEach ( field => {
        field.props = { ...field.props, disabled: true }
        if ( field.fieldGroup ) disableRecursively ( field.fieldGroup )
      } )
    }
    disableRecursively ( fields )
  }

  return fields
}
