import { sqlite3Worker1Promiser, type SqlitePromiser } from '@sqlite.org/sqlite-wasm'
import type { FileRecord, FsKind, Id, ParentId, Content } from './types'

type FilesPromiser = SqlitePromiser<FileRecord>

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

export async function getFilesMetadata() {
  const promiser = await initDb()
  const result = await promiser('exec', {
    sql: 'SELECT id, name, parentId, type, updated_at FROM files ORDER BY type DESC, name ASC',
    rowMode: 'object',
    dbId
  })
  return result.result.resultRows ?? []
}

export async function saveFileContent(id: Id, content: Content) {
  const promiser = await initDb()
  try {
    await promiser('exec', {
      sql: 'UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      bind: [content, id],
      dbId
    })
    console.log('File content updated successfully')
  } catch (error) {
    console.error('Failed to update file content:', error)
    throw error
  }
}

export async function createFile(
  name: string,
  parentId: ParentId,
  type: FsKind,
  content: Content = '',
  explicitId?: Id
) {
  const promiser = await initDb()
  const id = explicitId || crypto.randomUUID()
  try {
    await promiser('exec', {
      sql: 'INSERT INTO files (id, name, parentId, type, content) VALUES (?, ?, ?, ?, ?)',
      bind: [id, name, parentId, type, content],
      dbId
    })
    console.log(`Created ${type}: ${name}`)
    return id
  } catch (error) {
    console.error(`Failed to create ${type}:`, error)
    throw error
  }
}

export async function renameFile(id: Id, newName: string) {
  const promiser = await initDb()
  try {
    await promiser('exec', {
      sql: 'UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      bind: [newName, id],
      dbId
    })
    console.log(`Renamed file ${id} to ${newName}`)
  } catch (error) {
    console.error('Failed to rename file:', error)
    throw error
  }
}

export async function moveFile(id: Id, newParentId: ParentId) {
  const promiser = await initDb()
  try {
    await promiser('exec', {
      sql: 'UPDATE files SET parentId = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      bind: [newParentId, id],
      dbId
    })
    console.log(`Moved file ${id} to parent ${newParentId}`)
  } catch (error) {
    console.error('Failed to move file:', error)
    throw error
  }
}

export async function deleteFile(id: Id) {
  const promiser = await initDb()
  try {
    await promiser('exec', {
      sql: `
        WITH RECURSIVE
          descendants(id) AS (
            SELECT id FROM files WHERE id = ?
            UNION ALL
            SELECT f.id FROM files f
            JOIN descendants d ON f.parentId = d.id
          )
        DELETE FROM files WHERE id IN descendants;
      `,
      bind: [id],
      dbId
    })
    console.log(`Deleted file/directory ${id} and its descendants`)
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
}

export async function getFileContent(id: Id) {
  const promiser = await initDb()
  const result = await promiser('exec', {
    sql: 'SELECT content FROM files WHERE id = ?',
    bind: [id],
    rowMode: 'object',
    dbId
  })
  const rows = result.result.resultRows
  return rows && rows.length > 0 ? rows[0].content : ''
}

export async function getBatchFileContent(ids: Id[]) {
  if (ids.length === 0) return {}
  const promiser = await initDb()
  const placeholders = ids.map(() => '?').join(',')

  const result = await promiser('exec', {
    sql: `SELECT id, content FROM files WHERE id IN (${placeholders})`,
    bind: ids,
    rowMode: 'object',
    dbId
  })

  if (!result.result.resultRows) return {}

  return result.result.resultRows.reduce(
    (acc, row) => {
      acc[row.id] = row.content
      return acc
    },
    {} as Record<string, string>
  )
}

export async function resetFileSystem() {
  const promiser = await initDb()
  await promiser('exec', { sql: 'DELETE FROM files', dbId })
  console.log('File system reset successfully')
}
