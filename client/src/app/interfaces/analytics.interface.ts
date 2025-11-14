export interface OverviewMetrics {
  activeUsers: string
  sessions: string
  avgSessionDuration: string
  engagementRate: string
  conversions: string
}

export interface TrendDataPoint {
  date: string // YYYYMMDD format
  activeUsers: number
  sessions: number
}

export interface GeographyData {
  country: string
  city: string
  activeUsers: number
  sessions: number
}

export interface DeviceData {
  deviceCategory: string
  sessions: number
  activeUsers: number
}

export interface TrafficSourceData {
  channel: string
  sessions: number
}

export interface DashboardData {
  overview: OverviewMetrics
  trendData: TrendDataPoint [ ]
  geoData: GeographyData [ ]
  deviceData: DeviceData [ ]
  trafficSourceData: TrafficSourceData [ ]
}