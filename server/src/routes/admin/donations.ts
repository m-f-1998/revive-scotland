import { FastifyPluginAsync } from "fastify"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"
import Stripe from "stripe"

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", { preHandler: checkFirebaseAuth }, async ( _req, rep ) => {
    try {
      if ( !process.env [ "STRIPE_SECRET_KEY" ] ) {
        return rep.status ( 500 ).send ( "Stripe secret key not configured." )
      }

      const stripe = new Stripe ( process.env [ "STRIPE_SECRET_KEY" ] )

      const sessions: Stripe.Checkout.Session [ ] = [ ]
      let startingAfter: string | undefined

      // Paginate through Checkout sessions (Stripe max page size 100)
      for ( let page = 0; page < 20; page++ ) {
        const batch = await stripe.checkout.sessions.list ( {
          limit: 100,
          expand: [ "data.line_items" ],
          ...( startingAfter ? { starting_after: startingAfter } : { } )
        } )
        sessions.push ( ...batch.data )
        if ( !batch.has_more || batch.data.length === 0 ) break
        startingAfter = batch.data [ batch.data.length - 1 ]!.id
      }

      const donations = sessions
        .filter ( session => session.payment_status === "paid" )
        .map ( session => {
          const isEvent = !!session.client_reference_id
          const eventName = isEvent ? ( session.line_items?.data [ 0 ]?.description || "Event Registration" ) : undefined
          return {
            id: session.id,
            amount: session.amount_total,
            currency: session.currency,
            customerDetails: session.customer_details,
            paymentIntent: session.payment_intent,
            status: session.status,
            createdAt: new Date ( session.created * 1000 ).toISOString ( ),
            isEvent,
            eventName
          }
        } )
        .sort ( ( a, b ) => new Date ( b.createdAt ).getTime ( ) - new Date ( a.createdAt ).getTime ( ) )

      return rep.status ( 200 ).send ( { donations } )
    } catch ( error ) {
      console.error ( "Error fetching donations from Stripe:", error )
      return rep.status ( 500 ).send ( "Failed to fetch donations." )
    }
  } )
}
