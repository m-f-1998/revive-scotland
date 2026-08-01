import Stripe from "stripe"
import { isDevMode } from "../routes/static.js"

export class StripeService {
  private static get stripeInstance ( ): Stripe | null {
    const key = process.env [ "STRIPE_SECRET_KEY" ]
    if ( !key ) return null
    return new Stripe ( key )
  }

  public static async createEventCheckoutSession (
    eventId: string,
    priceId: string,
    registrationRefId: string
  ): Promise<string | undefined> {
    const stripe = this.stripeInstance
    if ( !stripe ) return undefined

    const host = isDevMode ( ) ? "http://localhost:4200" : "https://revivescotland.co.uk"

    const session = await stripe.checkout.sessions.create ( {
      payment_method_types: [ "card" ],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        transfer_group: eventId // Links funds into an event-specific "pot" for future multi-bank payouts
      },
      success_url: `${host}/events?registration=success`,
      cancel_url: `${host}/events?registration=cancelled`,
      client_reference_id: registrationRefId,
    } )

    return session.url || undefined
  }

  public static constructWebhookEvent ( rawBody: string | Buffer, signature: string ): Stripe.Event {
    const stripe = this.stripeInstance
    const endpointSecret = process.env [ "STRIPE_WEBHOOK_SECRET" ]

    if ( !stripe || !endpointSecret ) {
      throw new Error ( "Stripe is not configured." )
    }

    return stripe.webhooks.constructEvent (
      rawBody,
      signature,
      endpointSecret
    )
  }
}
