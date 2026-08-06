import { readFileSync } from "fs"
import { resolve } from "path"
import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { ServiceAccount } from "firebase-admin/app"
import { config } from "dotenv"
import { loadFirebaseServiceAccount } from "./firebase-credentials.js"

config ( { path: resolve ( process.cwd ( ), ".env" ), quiet: true } )

/**
 * GA Data API access is granted to the *production* Firebase SA (property 477989791),
 * not the Auth project used for DEV_MODE / PRE_PROD. Prefer an explicit GA secret,
 * then the prod JSON file, then the general Firebase credentials loader.
 */
const loadAnalyticsCredentials = ( ): ServiceAccount & { project_id?: string } => {
  const inline = process.env [ "GA_SERVICE_ACCOUNT_JSON" ]
  if ( inline?.trim ( ) ) {
    return JSON.parse ( inline ) as ServiceAccount & { project_id?: string }
  }

  const gaPath = process.env [ "GA_GOOGLE_APPLICATION_CREDENTIALS" ]
  if ( gaPath?.trim ( ) ) {
    return JSON.parse ( readFileSync ( gaPath, "utf8" ) ) as ServiceAccount & { project_id?: string }
  }

  const prodFile = resolve ( process.cwd ( ), "src/revive-scotland-firebase.json" )
  try {
    return JSON.parse ( readFileSync ( prodFile, "utf8" ) ) as ServiceAccount & { project_id?: string }
  } catch {
    // Last resort (e.g. container with only FIREBASE_SERVICE_ACCOUNT_JSON that also has GA access)
    return loadFirebaseServiceAccount ( ) as ServiceAccount & { project_id?: string }
  }
}

export class GoogleAnalyticsService {
  private static client: BetaAnalyticsDataClient | null = null
  private static readonly projectID = "477989791"
  private static readonly dateRanges = [ { startDate: "90daysAgo", endDate: "today" } ]

  private static get analyticsDataClient ( ): BetaAnalyticsDataClient {
    if ( !this.client ) {
      const serviceAccount = loadAnalyticsCredentials ( )
      this.client = new BetaAnalyticsDataClient ( {
        credentials: serviceAccount,
        projectId: serviceAccount.project_id
      } )
    }
    return this.client
  }

  public static async fetchOverviewMetrics ( ) {
    const [ response ] = await this.analyticsDataClient.runReport ( {
      property: `properties/${this.projectID}`,
      dateRanges: this.dateRanges,
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
        { name: "conversions" }
      ]
    } )

    if ( response.rows && response.rows.length > 0 ) {
      const values = response.rows [ 0 ].metricValues
      if ( values && values.length >= 5 ) {
        return {
          activeUsers: values [ 0 ].value,
          sessions: values [ 1 ].value,
          avgSessionDuration: values [ 2 ].value,
          engagementRate: ( parseFloat ( values [ 3 ].value ?? "0" ) * 100 ).toFixed ( 2 ) + "%",
          conversions: values [ 4 ].value,
        }
      }
    }
    return { }
  }

  public static async fetchTrendMetrics ( ) {
    const [ response ] = await this.analyticsDataClient.runReport ( {
      property: `properties/${this.projectID}`,
      dateRanges: this.dateRanges,
      dimensions: [ { name: "date" } ],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
      ],
      orderBys: [
        { dimension: { dimensionName: "date" } },
      ],
    } )

    if ( !response.rows ) return [ ]

    return response.rows.map ( row => ( {
      date: row.dimensionValues?. [ 0 ]?.value ?? "",
      activeUsers: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
      sessions: parseInt ( row.metricValues?. [ 1 ]?.value ?? "0", 10 ),
    } ) )
  }

  public static async fetchGeographyData ( ) {
    const [ response ] = await this.analyticsDataClient.runReport ( {
      property: `properties/${this.projectID}`,
      dateRanges: this.dateRanges,
      dimensionFilter: {
        filter: {
          fieldName: "country",
          stringFilter: {
            value: "United Kingdom",
            matchType: "EXACT"
          }
        }
      },
      dimensions: [ { name: "country" }, { name: "city" } ],
      metrics: [ { name: "activeUsers" }, { name: "sessions" } ],
      orderBys: [
        { desc: true, metric: { metricName: "activeUsers" } },
      ],
      limit: 50
    } )

    if ( !response.rows ) return [ ]

    return response.rows.map ( row => ( {
      country: row.dimensionValues?. [ 0 ]?.value ?? "",
      city: row.dimensionValues?. [ 1 ]?.value ?? "",
      activeUsers: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
      sessions: parseInt ( row.metricValues?. [ 1 ]?.value ?? "0", 10 ),
    } ) )
  }

  public static async fetchDeviceData ( ) {
    const [ response ] = await this.analyticsDataClient.runReport ( {
      property: `properties/${this.projectID}`,
      dateRanges: this.dateRanges,
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

  public static async fetchTrafficSourceData ( ) {
    const [ response ] = await this.analyticsDataClient.runReport ( {
      property: `properties/${this.projectID}`,
      dateRanges: this.dateRanges,
      dimensions: [ { name: "sessionDefaultChannelGroup" } ],
      metrics: [ { name: "sessions" } ],
    } )

    if ( !response.rows ) return [ ]

    return response.rows.map ( row => ( {
      channel: row.dimensionValues?. [ 0 ]?.value ?? "",
      sessions: parseInt ( row.metricValues?. [ 0 ]?.value ?? "0", 10 ),
    } ) )
  }
}
