import type { FileService } from './types'

const DB_NAME = 'web-node-ide'
const STORE_NAME = 'files'
const MAX_LOCAL_STORAGE_SIZE = 5 * 1024

export class FileServiceImpl implements FileService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  private async ensureDb(): Promise<IDBDatabase> {
    if (this.db) return this.db

    if (!this.initPromise) {
      this.initPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          this.db = request.result
          resolve()
        }

        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'path' })
          }
        }
      })
    }

    await this.initPromise
    return this.db!
  }

  async readFile(path: string): Promise<string> {
    const cached = localStorage.getItem(`file:${path}`)
    if (cached) return cached

    try {
      const db = await this.ensureDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(path)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.content)
          } else {
            reject(new Error(`File not found: ${path}`))
          }
        }
      })
    } catch (err) {
      throw new Error(`Failed to read file ${path}: ${err}`)
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (content.length < MAX_LOCAL_STORAGE_SIZE) {
      localStorage.setItem(`file:${path}`, content)
      return
    }

    try {
      const db = await this.ensureDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.put({ path, content, timestamp: Date.now() })

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (err) {
      throw new Error(`Failed to write file ${path}: ${err}`)
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    const files: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('file:')) {
        const filePath = key.slice(5)
        if (filePath.startsWith(path)) {
          files.push(filePath)
        }
      }
    }

    try {
      const db = await this.ensureDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.getAll()

        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const dbFiles = request.result
            .filter((f: { path: string }) => f.path.startsWith(path))
            .map((f: { path: string }) => f.path)
          resolve([...new Set([...files, ...dbFiles])])
        }
      })
    } catch {
      return files
    }
  }

  async deleteFile(path: string): Promise<void> {
    localStorage.removeItem(`file:${path}`)

    try {
      const db = await this.ensureDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.delete(path)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (err) {
      throw new Error(`Failed to delete file ${path}: ${err}`)
    }
  }
}
