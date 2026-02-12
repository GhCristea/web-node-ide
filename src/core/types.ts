/**
 * Shared types for web-node-ide.
 */

/**
 * WebContainers-compatible file system tree structure.
 * Used for mounting initial files and directories.
 *
 * Example:
 * {
 *   'package.json': {
 *     file: {
 *       contents: '{"name": "app"}'
 *     }
 *   },
 *   'src': {
 *     directory: {
 *       'main.js': {
 *         file: {
 *           contents: 'console.log("hello")'
 *         }
 *       }
 *     }
 *   }
 * }
 */
export type FileSystemTree = Record<string, FileEntry | DirectoryEntry>

export interface FileEntry {
  file: {
    contents: string | Uint8Array
  }
}

export interface DirectoryEntry {
  directory: FileSystemTree
}

export type FileEntryOrDirectory = FileEntry | DirectoryEntry

/**
 * Log entry for execution output.
 */
export interface LogEntry {
  type: 'log' | 'error' | 'debug'
  message: string
  timestamp: number
}

/**
 * Editor context stored in state machine.
 */
export interface EditorContext {
  currentPath: string | null
  content: string
  lastSaved: string
  logs: LogEntry[]
  error: string | null
}

/**
 * Execution result from running Node.js code.
 */
export interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Toast notification.
 */
export interface Toast {
  id: string
  message: string
  type: 'info' | 'error' | 'success'
  duration?: number
}
