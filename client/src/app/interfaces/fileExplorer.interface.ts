export interface FileEntry {
  name: string
  key: string
  isFolder: boolean
  lastModified?: Date
  size?: number
  contentType?: string
}

export interface Quota {
  used: number
  max: number
  remaining: number
}