export interface Event {
  id: string
  title: string
  description?: string
  when?: string
  longitude?: number
  latitude?: number
  showcase_image?: string
  donation_requested?: boolean
  donation_amount?: number
  payment_required?: boolean
  payment_amount?: number
  address?: string
}