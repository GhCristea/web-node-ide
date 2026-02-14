import { sqlite3Worker1Promiser, type SqlitePromiser } from '@sqlite.org/sqlite-wasm'
import type { FileRecord, Id } from '../types'

export type FilesPromiser = SqlitePromiser<FileRecord>

let dbPromise: Promise<FilesPromiser> | null = null
let dbId: Id | null = null

async function createFileSystemSchema(promiser: FilesPromiser) {
  await promiser('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parentId TEXT,
        type TEXT CHECK( type IN ('file', 'directory') ) NOT NULL DEFAULT 'file',
        content TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    dbId
  })
}

export async function initDb() {
  if (dbPromise) return dbPromise

  // eslint-disable-next-line no-async-promise-executor
  dbPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('Loading and initializing SQLite3 module...')

      const promiser = await new Promise<FilesPromiser>(resolve => {
        const _promiser = sqlite3Worker1Promiser({ onready: () => resolve(_promiser) })
      })

      console.log('Done initializing. Opening database...')

      let openResponse
      try {
        openResponse = await promiser('open', { filename: 'file:ide.sqlite3?vfs=opfs' })
        console.log('OPFS database opened:', openResponse.result.filename)
      } catch (opfsError) {
        console.warn('OPFS is not available, falling back to in-memory database:', opfsError)
        openResponse = await promiser('open', { filename: ':memory:' })
        console.log('In-memory database opened')
      }

      dbId = openResponse.result.dbId

      await createFileSystemSchema(promiser)

      console.log('Database initialized successfully')
      resolve(promiser)
    } catch (err) {
      console.error('Failed to initialize or migrate database:', err)
      reject(err)
    }
  })

  return dbPromise
}

export function getDbId() {
  return dbId
}
