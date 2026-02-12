import type { FileSystemTree } from '../types'

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

export class FileSystemService {
  private db: IDBDatabase | null = null
  private dbName = 'web-node-ide-fs'
  private storeName = 'files'

  private getDB(): IDBDatabase {
    if (!this.db) throw new Error('FileSystemService not initialized')
    return this.db
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'path' })
        }
      }
    })
  }

  async mount(tree: FileSystemTree, mountPoint: string = '/'): Promise<void> {
    const db = this.getDB()

    if (mountPoint !== '/') {
      await this.mkdir(mountPoint, { recursive: true })
    }

    const entries = this.flattenTree(tree, mountPoint)
    const tx = db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      entries.forEach(entry => {
        store.put(entry)
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async readFile(path: string, encoding?: 'utf-8' | 'buffer'): Promise<string | Uint8Array> {
    const db = this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
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

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const db = this.getDB()

    const normalized = this.normalizePath(path)
    const dir = this.dirname(normalized)

    try {
      await this.readFile(dir)
    } catch {
      await this.mkdir(dir, { recursive: true })
    }

    let buffer: Uint8Array
    if (typeof content === 'string') {
      const encoder = new TextEncoder()
      buffer = encoder.encode(content)
    } else {
      buffer = content
    }

    const entry = { path: normalized, type: 'file' as const, content: buffer, modified: Date.now() }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.put(entry)

      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async readdir(path: string, options?: ReadDirOptions): Promise<string[] | Dirent[]> {
    const db = this.getDB()

    const normalized = this.normalizePath(path)
    const prefix = normalized.endsWith('/') ? normalized : normalized + '/'

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const allEntries = request.result as Array<{ path: string; type: 'file' | 'directory' }>

        const names = new Set<string>()
        allEntries.forEach(entry => {
          if (entry.path.startsWith(prefix)) {
            const relative = entry.path.slice(prefix.length)
            const name = relative.split('/')[0]
            if (name) names.add(name)
          }
        })

        if (options?.withFileTypes) {
          const dirents: Dirent[] = Array.from(names).map(name => {
            const fullPath = prefix + name
            const entry = allEntries.find(e => e.path === fullPath)
            const type = entry?.type || 'file'
            return { name, isFile: () => type === 'file', isDirectory: () => type === 'directory' }
          })
          resolve(dirents)
        } else {
          resolve(Array.from(names))
        }
      }
    })
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    const db = this.getDB()

    const normalized = this.normalizePath(path)
    const parts = normalized.split('/').filter(Boolean)
    const paths: string[] = []

    parts.forEach((_, i) => {
      paths.push('/' + parts.slice(0, i + 1).join('/'))
    })

    if (!options?.recursive && paths.length > 1) {
      const parent = paths[paths.length - 2]
      try {
        await this.readdir(parent)
      } catch {
        throw new Error(`Parent directory does not exist: ${parent}`)
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)

      paths.forEach(dirPath => {
        const entry = { path: dirPath, type: 'directory' as const, modified: Date.now() }
        store.put(entry)
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    const db = this.getDB()

    const normalized = this.normalizePath(path)

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
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

          const deleteRequest = store.getAll()
          deleteRequest.onsuccess = () => {
            const allEntries = deleteRequest.result
            const prefix = normalized.endsWith('/') ? normalized : normalized + '/'
            allEntries.forEach(e => {
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

  async clear(): Promise<void> {
    const db = this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  private normalizePath(path: string): string {
    return '/' + path.split('/').filter(Boolean).join('/')
  }

  private dirname(path: string): string {
    const normalized = this.normalizePath(path)
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length <= 1) return '/'
    return '/' + parts.slice(0, -1).join('/')
  }

  private flattenTree(
    tree: FileSystemTree,
    basePath: string = '/'
  ): Array<{ path: string; type: 'file' | 'directory'; content?: Uint8Array; modified: number }> {
    const entries: Array<{ path: string; type: 'file' | 'directory'; content?: Uint8Array; modified: number }> = []
    const now = Date.now()

    const walk = (obj: FileSystemTree, path: string) => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullPath = path === '/' ? `/${key}` : `${path}/${key}`

        if ('file' in value && value?.file?.contents !== undefined) {
          const content = value.file.contents
          const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content
          entries.push({ path: fullPath, type: 'file', content: buffer, modified: now })
        } else if ('directory' in value && value?.directory !== undefined) {
          entries.push({ path: fullPath, type: 'directory', modified: now })

          walk(value.directory, fullPath)
        }
      })
    }

    walk(tree, basePath)
    return entries
  }
}
