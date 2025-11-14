import { Router } from "express"
import type { Request, Response } from "express"

export const router: Router = Router ( )

import admin, { ServiceAccount } from "firebase-admin"
import serviceAccount from "../revive-scotland-firebase.json" with { type: "json" }
import { BetaAnalyticsDataClient } from "@google-analytics/data"

admin.initializeApp ( {
  credential: admin.credential.cert ( serviceAccount as ServiceAccount )
} )

const analyticsDataClient = new BetaAnalyticsDataClient ( )
const projectID = "477989791"
// Define a consistent date range for analytics (e.g., last 30 days)
const dateRanges = [ { startDate: "30daysAgo", endDate: "today" } ]

router.get ( "/role", async ( req: Request, res: Response ) => {
  const uid = req.query [ "uid" ] as string

  if ( !uid ) {
    return res.status ( 400 ).json ( { error: "Missing uid parameter" } )
  }

  try {
    const user = await admin.auth ( ).getUser ( uid )
    if ( !user ) {
      return res.status ( 404 ).json ( { error: "User not found" } )
    }

    let role = user.customClaims?. [ "role" ] || "viewer"

    if ( user.email === "admin@matthewfrankland.co.uk" ) role = "superadmin"
    else if ( user.email === "revivescotlandx@gmail.com" ) role = "admin"

    if ( !user.customClaims?. [ "role" ] || user.customClaims [ "role" ] !== role ) {
      await admin.auth ( ).setCustomUserClaims ( uid, { role } )
    }

    return res.status ( 200 ).json ( { uid: user.uid, role } )
  } catch ( error ) {
    console.error ( "Error fetching user data:", error )
    return res.status ( 500 ).json ( { error: "Internal server error" } )
  }
} )

router.get ( "/isAdmin", async ( req: Request, res: Response ) => {
  const uid = req.query [ "uid" ] as string

  if ( !uid ) {
    return res.status ( 400 ).json ( { error: "Missing uid parameter" } )
  }

  try {
    const user = await admin.auth ( ).getUser ( uid )
    if ( !user ) {
      return res.status ( 404 ).json ( { error: "User not found" } )
    }

    const role = user.customClaims?. [ "role" ] || "viewer"
    const isAdmin = role === "admin" || role === "superadmin"

    return res.status ( 200 ).json ( { uid: user.uid, isAdmin } )
  } catch ( error ) {
    console.error ( "Error fetching user data:", error )
    return res.status ( 500 ).json ( { error: "Internal server error" } )
  }
} )

// --- 1. OVERVIEW REPORT ---
const fetchOverviewMetrics = async ( ) => {
  const [ response ] = await analyticsDataClient.runReport ( {
    property: `properties/${projectID}`,
    dateRanges: dateRanges,
    // Add all key summary metrics here
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "averageSessionDuration" },
      { name: "engagementRate" },
      { name: "conversions" } // If you have conversions set up
    ],
  } )

  // Since there's no dimension, the result will have a single row of totals
  if ( response.rows && response.rows.length > 0 ) {
    const values = response.rows [ 0 ].metricValues
    if ( !values ) return { }
    return {
      activeUsers: values [ 0 ].value,
      sessions: values [ 1 ].value,
      avgSessionDuration: values [ 2 ].value,
      engagementRate: ( parseFloat ( values [ 3 ].value ?? "0" ) * 100 ).toFixed ( 2 ) + "%", // Convert to readable percentage
      conversions: values [ 4 ].value,
    }
  }
  return { }
}

// --- 2. TREND REPORT ---
const fetchTrendMetrics = async ( ) => {
  const [ response ] = await analyticsDataClient.runReport ( {
    property: `properties/${projectID}`,
    dateRanges: dateRanges,
    // Break down by 'date' for a line chart
    dimensions: [ { name: "date" } ],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
    ],
    // Order the results chronologically
    orderBys: [ { dimension: { dimensionName: "date" } } ],
  } )

  if ( !response.rows ) return [ ]

  // Map the raw GA data into an Angular-friendly array of objects
  return response.rows.map ( row => ( {
    date: row.dimensionValues?. [ 0 ]?.value ?? "", // e.g., '20251113'
    activeUsers: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
    sessions: parseInt ( row.metricValues?. [ 1 ]?.value ?? "0", 10 ),
  } ) )
}

// --- 3. GEOGRAPHY REPORT ---
const fetchGeographyData = async ( ) => {
  const [ response ] = await analyticsDataClient.runReport ( {
    property: `properties/${projectID}`,
    dateRanges: dateRanges,
    // Use 'country' and 'city' dimensions
    dimensions: [ { name: "country" }, { name: "city" } ],
    metrics: [ { name: "activeUsers" }, { name: "sessions" } ],
    // Optionally order by active users descending, and limit to top 10
    orderBys: [ { metric: { metricName: "activeUsers" }, desc: true } ],
    limit: 10
  } )

  if ( !response.rows ) return [ ]

  return response.rows.map ( row => ( {
    country: row.dimensionValues?. [ 0 ]?.value ?? "",
    city: row.dimensionValues?. [ 1 ]?.value ?? "",
    activeUsers: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
    sessions: parseInt ( row.metricValues?. [ 1 ]?.value ?? "0", 10 ),
  } ) )
}

// --- 4. DEVICE REPORT ---
const fetchDeviceData = async ( ) => {
  const [ response ] = await analyticsDataClient.runReport ( {
    property: `properties/${projectID}`,
    dateRanges: dateRanges,
    // Use 'deviceCategory' dimension
    dimensions: [ { name: "deviceCategory" } ],
    metrics: [ { name: "sessions" }, { name: "activeUsers" } ],
  } )

  if ( !response.rows ) return [ ]

  return response.rows.map ( row => ( {
    deviceCategory: row.dimensionValues?. [ 0 ]?.value ?? "",
    sessions: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
    activeUsers: parseInt ( row.metricValues?. [ 1 ]?.value ?? "0", 10 ),
  } ) )
}

// --- 5. TRAFFIC SOURCE REPORT ---
const fetchTrafficSourceData = async ( ) => {
  const [ response ] = await analyticsDataClient.runReport ( {
    property: `properties/${projectID}`,
    dateRanges: dateRanges,
    // Use 'sessionDefaultChannelGroup' dimension (e.g., Organic Search, Direct, Referral)
    dimensions: [ { name: "sessionDefaultChannelGroup" } ],
    metrics: [ { name: "sessions" } ],
  } )

  if ( !response.rows ) return [ ]

  return response.rows.map ( row => ( {
    channel: row.dimensionValues?. [ 0 ]?.value ?? "",
    sessions: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
  } ) )
}

router.get ( "/analytics", async ( _req: Request, res: Response ) => {
  try {
    const [ overview, trendData, geographyData, deviceData, trafficSourceData ] = await Promise.all ( [
      fetchOverviewMetrics ( ),
      fetchTrendMetrics ( ),
      fetchGeographyData ( ),
      fetchDeviceData ( ),
      fetchTrafficSourceData ( ),
    ] )

    // Send a single, clean object back to the Angular client
    res.json ( {
      overview,
      trendData,
      geographyData,
      deviceData,
      trafficSourceData
    } )
  } catch ( error ) {
    console.error ( "Error fetching analytics data:", error )
    res.status ( 500 ).send ( "Failed to fetch analytics data." )
  }
} )