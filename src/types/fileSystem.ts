export interface FileNode {
  id: string
  name: string
  parentId: string | null
  type: 'file' | 'folder'
  children?: FileNode[]
}

export interface FileMetadata {
  id: string
  name: string
  parentId: string | null
  type: 'file' | 'folder'
  updated_at: string
}

export interface FileRecord extends FileMetadata {
  content: string | null
}
