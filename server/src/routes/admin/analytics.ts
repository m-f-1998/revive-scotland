import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { Router, Request, Response } from "express"

export const router: Router = Router ( )

const analyticsDataClient = new BetaAnalyticsDataClient ( )
const projectID = "477989791"
const dateRanges = [ { startDate: "90daysAgo", endDate: "today" } ]

const cacheDurationMs = 24 * 60 * 60 * 1000 // 1 day
let lastCacheTime = 0
let cache: [
  overview: {
    activeUsers?: string | null
    sessions?: string | null
    avgSessionDuration?: string | null
    engagementRate?: string
    conversions?: string | null
  },
  trendData: {
    date: string
    activeUsers: number
    sessions: number
  } [ ],
  geographyData: {
    country: string
    city: string
    activeUsers: number
    sessions: number
  } [ ],
  deviceData: {
    deviceCategory: string
    sessions: number
    activeUsers: number
  } [ ],
  trafficSourceData: {
    channel: string
    sessions: number
  } [ ]
] | null = null

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

router.get ( "/", async ( _req: Request, res: Response ) => {
  try {
    if ( cache && ( Date.now ( ) - lastCacheTime < cacheDurationMs ) ) {
      res.json ( {
        overview: cache [ 0 ],
        trendData: cache [ 1 ],
        geographyData: cache [ 2 ],
        deviceData: cache [ 3 ],
        trafficSourceData: cache [ 4 ],
      } )
      return
    }

    const [ overview, trendData, geographyData, deviceData, trafficSourceData ] = await Promise.all ( [
      fetchOverviewMetrics ( ),
      fetchTrendMetrics ( ),
      fetchGeographyData ( ),
      fetchDeviceData ( ),
      fetchTrafficSourceData ( ),
    ] )

    // Update cache
    cache = [ overview, trendData, geographyData, deviceData, trafficSourceData ]
    lastCacheTime = Date.now ( )

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