import { FormlyFieldConfig } from "@ngx-formly/core"

export interface Event {
  id: string
  title: string
  description: string
  location: string
  imageUrl?: string // S3 URL after upload
  startDate: Date
  endDate: Date
  startTime?: string // format "HH:MM"
  endTime?: string // format "HH:MM"

  // Action Fields
  actionType: "webpage" | "contact" // Determines which fields are shown
  webpageUrl?: string // Only if actionType is 'webpage'

  // Contact Form Fields
  contactFormFields?: FormlyFieldConfig [ ] // The Formly fields array (for contact form)

  // Donation / Payment Fields
  donationRequired?: "none" | "optional" | "required"
  donationDescription?: string
  donationPrice?: number // in pence/cents
  stripeProductId?: string
  stripePriceId?: string
}