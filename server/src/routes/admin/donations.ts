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

      // Fetch successful checkout sessions that are NOT linked to an event (no client_reference_id)
      const sessions = await stripe.checkout.sessions.list ( {
        limit: 100,
        expand: [ "data.line_items" ]
      } )

      const generalDonations = sessions.data
        .filter ( session => session.payment_status === "paid" && !session.client_reference_id )
        .map ( session => ( {
          id: session.id,
          amount: session.amount_total,
          currency: session.currency,
          customerDetails: session.customer_details,
          paymentIntent: session.payment_intent,
          status: session.status,
          createdAt: new Date ( session.created * 1000 ).toISOString ( )
        } ) )
        .sort ( ( a, b ) => new Date ( b.createdAt ).getTime ( ) - new Date ( a.createdAt ).getTime ( ) )

      return rep.status ( 200 ).send ( { donations: generalDonations } )
    } catch ( error ) {
      console.error ( "Error fetching general donations from Stripe:", error )
      return rep.status ( 500 ).send ( "Failed to fetch general donations." )
    }
  } )
}

