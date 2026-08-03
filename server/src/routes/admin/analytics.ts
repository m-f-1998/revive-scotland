import { FastifyPluginAsync } from "fastify"
import { GoogleAnalyticsService } from "../../services/google-analytics.service.js"
import { checkFirebaseAuth } from "./middleware/fileExplorer.js"

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

export const router: FastifyPluginAsync = async app => {
  app.get ( "/", { preHandler: checkFirebaseAuth }, async ( _req, rep ) => {
    try {
      if ( cache && ( Date.now ( ) - lastCacheTime < cacheDurationMs ) ) {
        return rep.send ( {
          overview: cache [ 0 ],
          trendData: cache [ 1 ],
          geographyData: cache [ 2 ],
          deviceData: cache [ 3 ],
          trafficSourceData: cache [ 4 ],
        } )
      }

      const [ overview, trendData, geographyData, deviceData, trafficSourceData ] = await Promise.all ( [
        GoogleAnalyticsService.fetchOverviewMetrics ( ),
        GoogleAnalyticsService.fetchTrendMetrics ( ),
        GoogleAnalyticsService.fetchGeographyData ( ),
        GoogleAnalyticsService.fetchDeviceData ( ),
        GoogleAnalyticsService.fetchTrafficSourceData ( ),
      ] )

      cache = [ overview, trendData, geographyData, deviceData, trafficSourceData ]
      lastCacheTime = Date.now ( )

      return rep.send ( {
        overview,
        trendData,
        geographyData,
        deviceData,
        trafficSourceData
      } )
    } catch ( error ) {
      console.error ( "Error fetching analytics data:", error )
      return rep.status ( 500 ).send ( "Failed to fetch analytics data." )
    }
  } )
}