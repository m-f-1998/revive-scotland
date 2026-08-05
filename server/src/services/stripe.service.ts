import Stripe from "stripe"
import { isDevMode } from "../routes/static.js"

export class StripeService {
  public static getStripeInstance ( ): Stripe | null {
    const key = process.env [ "STRIPE_SECRET_KEY" ]
    if ( !key ) return null
    if ( isDevMode ( ) && key.startsWith ( "sk_live_" ) ) {
      throw new Error ( "CRITICAL: A Live Stripe Secret Key (sk_live_...) was detected in DEV_MODE. To prevent accidental charges, live keys are blocked in development. Please use a Stripe Test Mode Key (sk_test_...) instead." )
    }
    return new Stripe ( key )
  }

  public static async createEventCheckoutSession (
    eventId: string,
    priceId: string,
    draftId: string,
    customAmount?: number,
    productId?: string,
    customerEmail?: string
  ): Promise<string | undefined> {
    const host = isDevMode ( ) ? "http://localhost:4200" : "https://revivescotland.co.uk"
    const stripe = this.getStripeInstance ( )

    if ( !stripe ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Stripe is not configured in DEV_MODE. Returning simulated sandbox success URL." )
        return `${host}/events?registration=success&eventId=${encodeURIComponent ( eventId )}&draftId=${encodeURIComponent ( draftId )}`
      }
      return undefined
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = customAmount != null
      ? {
        price_data: {
          currency: "gbp",
          unit_amount: customAmount,
          product: productId || undefined,
          product_data: productId ? undefined : {
            name: "Optional Event Donation",
          }
        },
        quantity: 1,
      }
      : {
        price: priceId,
        quantity: 1,
      }

    const session = await stripe.checkout.sessions.create ( {
      payment_method_types: [ "card" ],
      line_items: [ lineItem ],
      mode: "payment",
      customer_email: customerEmail || undefined,
      customer_creation: customerEmail ? "always" : undefined,
      payment_intent_data: {
        transfer_group: eventId,
        receipt_email: customerEmail || undefined
      },
      success_url: `${host}/events?registration=success&eventId=${encodeURIComponent ( eventId )}`,
      cancel_url: `${host}/events?registration=cancelled&eventId=${encodeURIComponent ( eventId )}&draftId=${encodeURIComponent ( draftId )}`,
      client_reference_id: draftId,
      metadata: {
        draftId,
        eventId
      }
    } )

    return session.url || undefined
  }

  /**
   * Creates and emails a Stripe Invoice (Stripe sends the email — no SMTP).
   * Used for optional "donate later" links and for unpaid required-donation prompts.
   */
  public static async createAndSendDonationInvoice ( opts: {
    email: string
    name?: string
    amountPence: number
    eventId: string
    eventTitle: string
    registrationId: string
    description?: string
    footer?: string
    daysUntilDue?: number
  } ): Promise<{ invoiceId: string; hostedInvoiceUrl: string | null } | undefined> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Stripe is not configured in DEV_MODE. Skipping donation invoice email." )
        return undefined
      }
      return undefined
    }

    if ( !opts.email || !opts.amountPence || opts.amountPence < 50 ) {
      return undefined
    }

    const existing = await stripe.customers.list ( { email: opts.email, limit: 1 } )
    const customer = existing.data [ 0 ] || await stripe.customers.create ( {
      email: opts.email,
      name: opts.name || undefined,
      metadata: { source: "event_registration" }
    } )

    await stripe.invoiceItems.create ( {
      customer: customer.id,
      currency: "gbp",
      amount: opts.amountPence,
      description: opts.description || `Donation — ${opts.eventTitle}`
    } )

    const invoice = await stripe.invoices.create ( {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: opts.daysUntilDue ?? 7,
      auto_advance: true,
      metadata: {
        registrationId: opts.registrationId,
        eventId: opts.eventId,
        eventTitle: opts.eventTitle
      },
      footer: opts.footer,
      pending_invoice_items_behavior: "include"
    } )

    if ( !invoice.id ) {
      throw new Error ( "Failed to create Stripe invoice." )
    }

    const finalized = await stripe.invoices.finalizeInvoice ( invoice.id )
    const sent = await stripe.invoices.sendInvoice ( finalized.id )

    return {
      invoiceId: sent.id!,
      hostedInvoiceUrl: sent.hosted_invoice_url || null
    }
  }

  /** Full refund of a PaymentIntent. Returns null if Stripe isn't configured or id is a local stub. */
  public static async refundPaymentIntent ( paymentIntentId: string ): Promise<{ refundId: string } | null> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Stripe is not configured in DEV_MODE. Skipping refund." )
        return { refundId: "dev_simulated_refund" }
      }
      return null
    }

    if ( !paymentIntentId || paymentIntentId === "dev_simulated" ) {
      return { refundId: "dev_simulated_refund" }
    }

    const existing = await stripe.refunds.list ( { payment_intent: paymentIntentId, limit: 10 } )
    const alreadyRefunded = existing.data.some ( (r: Stripe.Refund) => r.status === "succeeded" || r.status === "pending" )
    if ( alreadyRefunded ) {
      return { refundId: existing.data [ 0 ]!.id }
    }

    const refund = await stripe.refunds.create ( {
      payment_intent: paymentIntentId,
      reason: "requested_by_customer"
    } )

    return { refundId: refund.id }
  }

  /** Void an open/unpaid invoice so it can't be collected later. */
  public static async voidInvoiceIfOpen ( invoiceId: string ): Promise<boolean> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe || !invoiceId ) return false

    try {
      const invoice = await stripe.invoices.retrieve ( invoiceId )
      if ( invoice.status === "open" || invoice.status === "draft" ) {
        await stripe.invoices.voidInvoice ( invoiceId )
        return true
      }
      // Paid invoices are refunded via payment_intent instead
      return false
    } catch ( err ) {
      console.error ( "Failed to void Stripe invoice:", err )
      return false
    }
  }

  public static constructWebhookEvent ( rawBody: string | Buffer, signature: string ): Stripe.Event {
    const stripe = this.getStripeInstance ( )
    const endpointSecret = process.env [ "STRIPE_WEBHOOK_SECRET" ]

    if ( isDevMode ( ) && ( !endpointSecret || endpointSecret === "mock" ) ) {
      console.warn ( "reCAPTCHA / Stripe Webhook signature verification bypassed in DEV_MODE" )
      return JSON.parse ( rawBody.toString ( ) ) as Stripe.Event
    }

    if ( !stripe || !endpointSecret ) {
      throw new Error ( "Stripe is not configured." )
    }

    try {
      return stripe.webhooks.constructEvent (
        rawBody,
        signature,
        endpointSecret
      )
    } catch ( err ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Webhook signature verification failed, but bypassing in DEV_MODE: ", err )
        return JSON.parse ( rawBody.toString ( ) ) as Stripe.Event
      }
      throw err
    }
  }

  public static async createEventProductAndPrice ( title: string, pricePence: number ): Promise<{ productId: string, priceId: string } | undefined> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe ) return undefined

    const product = await stripe.products.create ( {
      name: title,
      type: "good"
    } )
    const price = await stripe.prices.create ( {
      product: product.id,
      unit_amount: pricePence,
      currency: "gbp"
    } )

    return { productId: product.id, priceId: price.id }
  }
}

