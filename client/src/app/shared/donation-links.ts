export const DONATION_STRIPE_LINK_LIVE = "https://donate.stripe.com/00w9AT9Reb7maMrenU3wQ00"
export const DONATION_STRIPE_LINK_TEST = "https://buy.stripe.com/test_aFa8wPdN4bRw3Wz02m7ss00"

/** Stripe Payment Link used on the public home page for the current environment. */
export const getActiveDonationStripeLink = ( ): string => {
  const hostname = window.location.hostname
  if ( hostname === "localhost" || hostname === "dev.revivescotland.co.uk" ) {
    return DONATION_STRIPE_LINK_TEST
  }
  return DONATION_STRIPE_LINK_LIVE
}
