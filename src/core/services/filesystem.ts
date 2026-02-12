/**
 * FileSystemService - Abstract virtual file system.
 * Compatible with WebContainers API structure.
 * Storage: IndexedDB (future: WebContainers, memfs, etc.)
 */

import type { FileSystemTree, FileEntry } from '../types'

export interface ReadOptions {
  encoding?: 'utf-8' | 'buffer'
}

export interface WriteOptions {
  encoding?: 'utf-8' | 'latin1'
}

export interface ReadDirOptions {
  withFileTypes?: boolean
  encoding?: 'utf-8' | 'buffer'
}

export interface Dirent {
  name: string
  isFile(): boolean
  isDirectory(): boolean
}

export interface MkdirOptions {
  recursive?: boolean
}

export interface RmOptions {
  recursive?: boolean
  force?: boolean
}

/**
 * Virtual file system service.
 * Provides filesystem operations: read, write, mkdir, rm, readdir.
 * Storage backend: IndexedDB.
 */
export class FileSystemService {
  private db: IDBDatabase | null = null
  private dbName = 'web-node-ide-fs'
  private storeName = 'files'

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'path' })
        }
      }
    })
  }

  /**
   * Mount initial file tree (WebContainers format).
   * Recursively walks tree and stores all files.
   */
  async mount(tree: FileSystemTree, mountPoint: string = '/'): Promise<void> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    // Ensure mountPoint exists
    if (mountPoint !== '/') {
      await this.mkdir(mountPoint, { recursive: true })
    }

    const entries = this.flattenTree(tree, mountPoint)
    const tx = this.db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      entries.forEach((entry) => {
        store.put(entry)
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Read file contents.
   * Returns UInt8Array by default, string if encoding specified.
   */
  async readFile(
    path: string,
    encoding?: 'utf-8' | 'buffer'
  ): Promise<string | Uint8Array> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.get(this.normalizePath(path))

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const entry = request.result
        if (!entry || entry.type !== 'file') {
          reject(new Error(`File not found: ${path}`))
          return
        }

        if (encoding === 'utf-8') {
          const decoder = new TextDecoder('utf-8')
          resolve(decoder.decode(entry.content))
        } else {
          resolve(entry.content)
        }
      }
    })
  }

  /**
   * Write file contents.
   * Creates file if it doesn't exist, overwrites if it does.
   */
  async writeFile(
    path: string,
    content: string | Uint8Array,
    options?: WriteOptions
  ): Promise<void> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    const normalized = this.normalizePath(path)
    const dir = this.dirname(normalized)

    // Ensure parent directory exists
    try {
      await this.readFile(dir)
    } catch {
      await this.mkdir(dir, { recursive: true })
    }

    // Convert content to Uint8Array
    let buffer: Uint8Array
    if (typeof content === 'string') {
      const encoder = new TextEncoder()
      buffer = encoder.encode(content)
    } else {
      buffer = content
    }

    const entry = {
      path: normalized,
      type: 'file' as const,
      content: buffer,
      modified: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.put(entry)

      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Read directory contents.
   * Returns string array by default, Dirent objects if withFileTypes specified.
   */
  async readdir(
    path: string,
    options?: ReadDirOptions
  ): Promise<string[] | Dirent[]> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    const normalized = this.normalizePath(path)
    const prefix = normalized.endsWith('/') ? normalized : normalized + '/'

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const allEntries = request.result as Array<{
          path: string
          type: 'file' | 'directory'
        }>

        // Filter entries in this directory (not nested)
        const names = new Set<string>()
        allEntries.forEach((entry) => {
          if (entry.path.startsWith(prefix)) {
            const relative = entry.path.slice(prefix.length)
            const name = relative.split('/')[0]
            if (name) names.add(name)
          }
        })

        if (options?.withFileTypes) {
          const dirents: Dirent[] = Array.from(names).map((name) => {
            const fullPath = prefix + name
            const entry = allEntries.find((e) => e.path === fullPath)
            const type = entry?.type || 'file'
            return {
              name,
              isFile: () => type === 'file',
              isDirectory: () => type === 'directory',
            }
          })
          resolve(dirents)
        } else {
          resolve(Array.from(names))
        }
      }
    })
  }

  /**
   * Create directory.
   * recursive=true creates nested folders.
   */
  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    const normalized = this.normalizePath(path)
    const parts = normalized.split('/').filter(Boolean)
    const paths: string[] = []

    // Build all parent paths
    parts.forEach((_, i) => {
      paths.push('/' + parts.slice(0, i + 1).join('/'))
    })

    if (!options?.recursive && paths.length > 1) {
      // Check if parent exists
      const parent = paths[paths.length - 2]
      try {
        await this.readdir(parent)
      } catch {
        throw new Error(`Parent directory does not exist: ${parent}`)
      }
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)

      paths.forEach((dirPath) => {
        const entry = {
          path: dirPath,
          type: 'directory' as const,
          modified: Date.now(),
        }
        store.put(entry)
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Delete file or directory.
   * recursive=true deletes directory and contents.
   */
  async rm(path: string, options?: RmOptions): Promise<void> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    const normalized = this.normalizePath(path)

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.get(normalized)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const entry = request.result

        if (!entry) {
          if (options?.force) {
            resolve()
            return
          }
          reject(new Error(`Path not found: ${path}`))
          return
        }

        if (entry.type === 'file') {
          store.delete(normalized)
        } else if (entry.type === 'directory') {
          if (!options?.recursive) {
            reject(new Error(`Use recursive: true to delete directory`))
            return
          }
          // Delete directory and all contents
          const deleteRequest = store.getAll()
          deleteRequest.onsuccess = () => {
            const allEntries = deleteRequest.result
            const prefix = normalized.endsWith('/') ? normalized : normalized + '/'
            allEntries.forEach((e) => {
              if (e.path === normalized || e.path.startsWith(prefix)) {
                store.delete(e.path)
              }
            })
          }
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Clear all files from storage.
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('FileSystemService not initialized')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Private helpers
   */
  private normalizePath(path: string): string {
    // Remove trailing slashes, ensure leading slash
    return '/' + path.split('/').filter(Boolean).join('/')
  }

  private dirname(path: string): string {
    const normalized = this.normalizePath(path)
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length <= 1) return '/'
    return '/' + parts.slice(0, -1).join('/')
  }

  /**
   * Flatten WebContainers tree format into flat entries.
   * Recursively walks nested structure.
   */
  private flattenTree(
    tree: FileSystemTree,
    basePath: string = '/'
  ): Array<{ path: string; type: 'file' | 'directory'; content?: Uint8Array; modified: number }> {
    const entries: Array<{ path: string; type: 'file' | 'directory'; content?: Uint8Array; modified: number }> = []
    const now = Date.now()

    const walk = (obj: any, path: string) => {
      Object.entries(obj).forEach(([key, value]: [string, any]) => {
        const fullPath = path === '/' ? `/${key}` : `${path}/${key}`

        if (value?.file?.contents !== undefined) {
          // It's a file
          const content = value.file.contents
          const buffer =
            typeof content === 'string' ? new TextEncoder().encode(content) : content
          entries.push({
            path: fullPath,
            type: 'file',
            content: buffer,
            modified: now,
          })
        } else if (value?.directory !== undefined) {
          // It's a directory
          entries.push({
            path: fullPath,
            type: 'directory',
            modified: now,
          })
          // Recurse into directory
          walk(value.directory, fullPath)
        }
      })
    }

    walk(tree, basePath)
    return entries
  }
}
