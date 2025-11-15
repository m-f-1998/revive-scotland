export interface OverviewMetrics {
  activeUsers: number
  sessions: number
  avgSessionDuration: number
  engagementRate: string
  conversions: number
}

export interface TrendDataPoint {
  date: number
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
  geographyData: GeographyData [ ]
  deviceData: DeviceData [ ]
  trafficSourceData: TrafficSourceData [ ]
}