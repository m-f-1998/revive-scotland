export interface Event {
  id: string
  title: string
  description?: string
  start?: Date
  end?: Date
  longitude?: number
  latitude?: number
  showcase_image?: string
  donation_requested?: boolean
  donation_amount?: number
  payment_required?: boolean
  payment_amount?: number
  location_name?: string
  address?: {
    road?: string
    village?: string
    county?: string
    state?: string
    postcode?: string
    country?: string
    country_code?: string
  }
  goto_event_link?: string
}


// TODO: Add Custom Questionnaire Interface
// TODO: Payment/Donation Interface