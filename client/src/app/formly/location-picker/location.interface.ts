export interface Location {
  formattedAddress: string
  addressComponents: Array<{
    longText: string
    shortText: string
    types: string[]
    languageCode: string
  }>
  location: {
    latitude: number
    longitude: number
  }
  displayName: {
    text: string
    languageCode: string
  }
}

export interface LocationLookup {
  id: string
  text: string
}