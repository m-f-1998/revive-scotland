export interface HeroEntry {
  id: string
  url: string // The permanent/long-lived signed URL
  title: string
  description: string
}

export interface PageHeroData {
  heroes: HeroEntry [ ]
}