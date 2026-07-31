export type PrayerCategory =
  | "our-lady"
  | "our-lord"
  | "angels"
  | "martyrs"

export type PrayerType =
  | "devotional"
  | "intercessory"
  | "liturgical"

export type FeastColour =
  | "White"
  | "Black"
  | "Purple"
  | "Red"
  | "Green"
  | "Rose"
  | "Gold"
  | "Violet"

export interface Prayer {
  id: string
  name: string
  category: PrayerCategory
  type: PrayerType
  text: string
  latin?: string
}

export interface Reflection {
  id: string
  title: string
  category: PrayerCategory
  youtubeId: string
}

export interface FeastReadings {
  firstReading?: string
  firstReadingSource?: string
  secondReading?: string
  secondReadingSource?: string
  psalm?: string
  psalmSource?: string
  gospelAcclamation?: string
  gospelAcclamationSource?: string
  gospel?: string
  gospelSource?: string
  copyright?: string
}

export interface FeastDay {
  name: string
  colour: FeastColour
  date: string
  universalisUrl: string
  readings?: FeastReadings
}

export interface PrayerGroup {
  key: PrayerCategory
  label: string
  prayers: Prayer [ ]
}

export const CategoryOrder: PrayerCategory [ ] = [ "our-lord", "our-lady", "martyrs", "angels" ]

export const CategoryLabel = {
  "our-lord": "Our Lord",
  "our-lady": "Our Lady",
  "martyrs": "Martyrs",
  "angels": "Angels"
}

export const TypeLabel = {
  "devotional": "Devotional",
  "intercessory": "Intercessory",
  "liturgical": "Liturgical"
}

export const ColourMap = {
  "White": "#FFFFFF",
  "Black": "#000000",
  "Purple": "#7C3AED",
  "Red": "#DC2626",
  "Green": "#16A34A",
  "Rose": "#EC4899",
  "Gold": "#B8962E",
  "Violet": "#7C3AED"
}