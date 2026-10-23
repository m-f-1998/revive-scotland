export interface PublicOrganization {
  id: string
  slug: string
  name: string
  logoUrl?: string
  websiteUrl?: string
  primaryColor?: string
  accentColor?: string
  tagline?: string
}

export interface AdminOrganization extends PublicOrganization {
  enabled?: boolean
  stripeConnectAccountId?: string | null
  stripeConnectChargesEnabled?: boolean
  stripeConnectPayoutsEnabled?: boolean
  stripeDevReady?: boolean
  platformFeePercent?: number | null
  platformFeeFixedPence?: number | null
  adminEmails?: string[]
}
