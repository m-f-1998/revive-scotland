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
  actionType: "webpage" | "form" // Determines which fields are shown
  webpageUrl?: string // Only if actionType is 'webpage'

  // Registration Form Fields
  contactFormFields?: FormlyFieldConfig [ ] // Formly fields for registration forms

  // Donation / Payment Fields
  donationRequired?: "none" | "optional" | "required"
  donationDescription?: string
  donationPrice?: number // in pence/cents
  stripeProductId?: string
  stripePriceId?: string
  maxAttendees?: number
  waitlistEnabled?: boolean
  registeredCount?: number
  spotsRemaining?: number | null
  isFull?: boolean
  waitlistOpen?: boolean
}
