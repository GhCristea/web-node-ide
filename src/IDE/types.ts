export type Id = string
export type ParentId = Id | null
export type Content = string
export type FsKind = FileSystemHandle['kind']

export interface FileNode {
  id: Id
  name: string
  parentId: ParentId
  type: FsKind
  children?: FileNode[]
}

export interface FileMetadata {
  id: Id
  name: string
  parentId: ParentId
  type: FsKind
  updated_at: string
}

export interface FileRecord extends FileMetadata {
  content: Content
}

type Terminal = import('@xterm/xterm').Terminal
export type DB = typeof import('./db')

export type TerminalHandle = Pick<Terminal, 'write'> | Pick<Terminal, 'write' | 'clear'>

export type MonacoOptions = Pick<
  Required<Pick<Parameters<typeof import('solid-monaco').MonacoEditor>[0], 'options'>>['options'],
  'fontFamily' | 'fontWeight' | 'fontSize' | 'fontVariations' | 'fontLigatures' | 'theme'
>
