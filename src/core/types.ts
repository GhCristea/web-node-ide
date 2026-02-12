export type FileSystemTree = Record<string, FileEntry | DirectoryEntry>

export interface FileEntry {
  file: { contents: string | Uint8Array }
}

export interface DirectoryEntry {
  directory: FileSystemTree
}

export type FileEntryOrDirectory = FileEntry | DirectoryEntry

export interface LogEntry {
  type: 'log' | 'error' | 'debug'
  message: string
  timestamp: number
}

export interface EditorContext {
  currentPath: string | null
  content: string
  lastSaved: string
  logs: LogEntry[]
  error: string | null
}

export interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface Toast {
  id: string
  message: string
  type: 'info' | 'error' | 'success'
  duration?: number
}
