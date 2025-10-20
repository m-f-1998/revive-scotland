export interface DBFile {
  id: string
  name: string
  size: number
  type: string
  path: string
  mime_type: string
  file_created_at: Date
  file_updated_at: Date
  shares?: {
    id: string
    token: string
    max_downloads: number
    downloads_used: number
    expires_at: Date | null
    created_at: Date
    updated_at: Date
  } [ ]
}

export interface FileNode {
  id: string | undefined
  name: string
  path: string
  isFolder: boolean
  children?: FileNode [ ]
  file?: DBFile
}