import Stripe from "stripe"
import { isDevMode } from "../routes/static.js"

export type EventCheckoutOpts = {
  orgSlug?: string
  successPath?: string
  cancelPath?: string
  successUrl?: string
  cancelUrl?: string
  connectAccountId?: string
  platformFeePence?: number
  paymentAmountPence?: number
  displayName?: string
  buttonColor?: string
  paymentNote?: string
}

export class StripeService {
  public static isLivemode ( ): boolean {
    const key = process.env [ "STRIPE_SECRET_KEY" ] || ""
    return key.startsWith ( "sk_live_" )
  }

  /** Local dev with a test key charges Revive's platform test account. Connect is for live payouts. */
  public static devUsesPlatformTestAccount ( ): boolean {
    const key = process.env [ "STRIPE_SECRET_KEY" ] || ""
    return isDevMode ( ) && key.startsWith ( "sk_test_" )
  }

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
    customerEmail?: string,
    checkoutOpts?: EventCheckoutOpts
  ): Promise<{ url: string; sessionId: string } | undefined> {
    const host = isDevMode ( )
      ? "http://localhost:4200"
      : ( process.env [ "PUBLIC_DOMAIN" ] || "https://revivescotland.co.uk" )
    const stripe = this.getStripeInstance ( )
    // Keep cancelToken out of redirect URLs (history / logs / Referer). Client uses sessionStorage.
    const returnQs = `eventId=${encodeURIComponent ( eventId )}&draftId=${encodeURIComponent ( draftId )}`
    const successBase = checkoutOpts?.successPath || "/events"
    const cancelBase = checkoutOpts?.cancelPath || successBase

    if ( !stripe ) {
      if ( isDevMode ( ) ) {
        console.warn ( "Stripe is not configured in DEV_MODE. Returning simulated sandbox success URL." )
        const url = `${host}${successBase}?registration=success&${returnQs}`
        return { url, sessionId: "dev_simulated" }
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

    const paymentAmountPence = checkoutOpts?.paymentAmountPence
      ?? ( customAmount != null ? customAmount : undefined )

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      transfer_group: eventId,
      receipt_email: customerEmail || undefined,
      metadata: {
        draftId,
        eventId,
        ...( checkoutOpts?.orgSlug ? { organizationSlug: checkoutOpts.orgSlug } : { } )
      }
    }

    if (
      checkoutOpts?.connectAccountId
      && checkoutOpts.platformFeePence
      && checkoutOpts.platformFeePence > 0
      && paymentAmountPence
      && checkoutOpts.platformFeePence < paymentAmountPence
    ) {
      paymentIntentData.application_fee_amount = checkoutOpts.platformFeePence
      paymentIntentData.transfer_data = { destination: checkoutOpts.connectAccountId }
    }

    const buttonColor = checkoutOpts?.buttonColor?.trim ( ) || ""
    const branding: Stripe.Checkout.SessionCreateParams.BrandingSettings = { }
    if ( checkoutOpts?.displayName?.trim ( ) ) branding.display_name = checkoutOpts.displayName.trim ( ).slice ( 0, 100 )
    if ( /^#[0-9A-Fa-f]{6}$/.test ( buttonColor ) ) branding.button_color = buttonColor
    const paymentNote = checkoutOpts?.paymentNote?.trim ( ).slice ( 0, 1200 )

    const session = await stripe.checkout.sessions.create ( {
      allowed_payment_method_types: [ "card" ],
      line_items: [ lineItem ],
      mode: "payment",
      customer_email: customerEmail || undefined,
      customer_creation: customerEmail ? "always" : undefined,
      payment_intent_data: paymentIntentData,
      branding_settings: Object.keys ( branding ).length ? branding : undefined,
      custom_text: paymentNote ? { submit: { message: paymentNote } } : undefined,
      success_url: checkoutOpts?.successUrl || `${host}${successBase}?registration=success&${returnQs}`,
      cancel_url: checkoutOpts?.cancelUrl || `${host}${cancelBase}?registration=cancelled&${returnQs}`,
      client_reference_id: draftId,
      metadata: {
        draftId,
        eventId,
        ...( checkoutOpts?.orgSlug ? { organizationSlug: checkoutOpts.orgSlug } : { } )
      }
    } )

    if ( !session.url || !session.id ) return undefined
    return { url: session.url, sessionId: session.id }
  }

  public static async createConnectOnboardingLink ( opts: {
    organizationId: string
    refreshUrl: string
    returnUrl: string
    existingAccountId?: string
  } ): Promise<{ url: string; accountId: string } | undefined> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe ) return undefined

    let accountId = opts.existingAccountId
    if ( !accountId ) {
      const account = await stripe.accounts.create ( {
        type: "express",
        metadata: { organizationId: opts.organizationId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      } )
      accountId = account.id
    }

    const link = await stripe.accountLinks.create ( {
      account: accountId,
      refresh_url: opts.refreshUrl,
      return_url: opts.returnUrl,
      type: "account_onboarding"
    } )

    return { url: link.url, accountId }
  }

  public static async retrieveConnectAccountStatus (
    accountId: string
  ): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean; payoutsEnabled: boolean } | undefined> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe || !accountId ) return undefined
    const account = await stripe.accounts.retrieve ( accountId )
    return {
      chargesEnabled: !!account.charges_enabled,
      detailsSubmitted: !!account.details_submitted,
      payoutsEnabled: !!account.payouts_enabled
    }
  }

  /** Expire an open Checkout Session so an older pay link cannot double-charge. */
  public static async expireCheckoutSession ( sessionId: string ): Promise<void> {
    const stripe = this.getStripeInstance ( )
    if ( !stripe || !sessionId || sessionId === "dev_simulated" ) return
    try {
      const session = await stripe.checkout.sessions.retrieve ( sessionId )
      if ( session.status === "open" ) {
        await stripe.checkout.sessions.expire ( sessionId )
      }
    } catch ( err ) {
      console.warn ( "Failed to expire Checkout session:", sessionId, err )
    }
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
    const alreadyRefunded = existing.data.some ( ( r: Stripe.Refund ) => r.status === "succeeded" || r.status === "pending" )
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

    // Only skip verification in explicit DEV_MODE with no real webhook secret.
    // Never fail-open when a secret is configured.
    if ( isDevMode ( ) && ( !endpointSecret || endpointSecret === "mock" ) ) {
      console.warn ( "Stripe webhook signature verification bypassed in DEV_MODE (no webhook secret)" )
      return JSON.parse ( rawBody.toString ( ) ) as Stripe.Event
    }

    if ( !stripe || !endpointSecret ) {
      throw new Error ( "Stripe is not configured." )
    }

    return stripe.webhooks.constructEvent (
      rawBody,
      signature,
      endpointSecret
    )
  }

  public static async createEventProductAndPrice ( title: string, pricePence: number ): Promise<{ productId: string; priceId: string } | undefined> {
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

