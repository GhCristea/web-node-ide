/* eslint-disable @typescript-eslint/no-explicit-any */
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

let dbPromise: Promise<(command: string, params: any) => Promise<any>> | null =
  null;
let dbId: string | null = null;

async function createFileSystemSchema(
  promiser: (command: string, params: any) => Promise<any>
) {
  await promiser('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parentId TEXT,
        type TEXT CHECK( type IN ('file', 'folder') ) NOT NULL DEFAULT 'file',
        content TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    dbId
  });
}

export async function initDb() {
  if (dbPromise) return dbPromise;

  // eslint-disable-next-line no-async-promise-executor
  dbPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('Loading and initializing SQLite3 module...');

      const promiser = (await new Promise<unknown>((resolve) => {
        const _promiser = sqlite3Worker1Promiser({
          onready: () => resolve(_promiser)
        });
      })) as (command: string, params: any) => Promise<any>;

      console.log('Done initializing. Opening database...');

      let openResponse;
      try {
        openResponse = await promiser('open', {
          filename: 'file:ide.sqlite3?vfs=opfs'
        });
        console.log('OPFS database opened:', openResponse.result.filename);
      } catch (opfsError) {
        console.warn(
          'OPFS is not available, falling back to in-memory database:',
          opfsError
        );
        openResponse = await promiser('open', {
          filename: ':memory:'
        });
        console.log('In-memory database opened');
      }

      dbId = openResponse.result.dbId;

      // create schema
      await createFileSystemSchema(promiser);

      console.log('Database initialized successfully');
      resolve(promiser);
    } catch (err) {
      console.error('Failed to initialize or migrate database:', err);
      reject(err);
    }
  });

  return dbPromise;
}

export interface FileRecord {
  id: string;
  name: string;
  parentId: string | null;
  type: 'file' | 'folder';
  content: string | null;
  updated_at: string;
}

export async function getFilesFromDb(): Promise<FileRecord[]> {
  const promiser = await initDb();
  const result = await promiser('exec', {
    sql: 'SELECT * FROM files ORDER BY type DESC, name ASC',
    rowMode: 'object',
    dbId
  });
  return result.result.resultRows || [];
}

export async function saveFileContent(id: string, content: string) {
  const promiser = await initDb();
  try {
    await promiser('exec', {
      sql: 'UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      bind: [content, id],
      dbId
    });
    console.log('File content updated successfully');
  } catch (error) {
    console.error('Failed to update file content:', error);
    throw error;
  }
}

export async function createFile(
  name: string,
  parentId: string | null,
  type: 'file' | 'folder',
  content: string = ''
) {
  const promiser = await initDb();
  const id = crypto.randomUUID();
  try {
    await promiser('exec', {
      sql: 'INSERT INTO files (id, name, parentId, type, content) VALUES (?, ?, ?, ?, ?)',
      bind: [id, name, parentId, type, content],
      dbId
    });
    console.log(`Created ${type}: ${name}`);
    return id;
  } catch (error) {
    console.error(`Failed to create ${type}:`, error);
    throw error;
  }
}

export async function renameFile(id: string, newName: string) {
  const promiser = await initDb();
  try {
    await promiser('exec', {
      sql: 'UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      bind: [newName, id],
      dbId
    });
    console.log(`Renamed file ${id} to ${newName}`);
  } catch (error) {
    console.error('Failed to rename file:', error);
    throw error;
  }
}

export async function deleteFile(id: string) {
  const promiser = await initDb();
  try {
    // Recursive delete using CTE
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
    });
    console.log(`Deleted file/folder ${id} and its descendants`);
  } catch (error) {
    console.error('Failed to delete file:', error);
    throw error;
  }
}

export async function getFileContent(id: string): Promise<string> {
  const promiser = await initDb();
  const result = await promiser('exec', {
    sql: 'SELECT content FROM files WHERE id = ?',
    bind: [id],
    rowMode: 'object',
    dbId
  });
  const rows = result.result.resultRows;
  return rows && rows.length > 0 ? rows[0].content : '';
}

export async function resetFileSystem() {
  const promiser = await initDb();
  await promiser('exec', {
    sql: 'DELETE FROM files',
    dbId
  });
  console.log('File system reset successfully');
}

export function generateFilePaths(files: FileRecord[]): Record<string, string> {
  const fileMap = new Map<string, FileRecord>(files.map((f) => [f.id, f]));
  const paths: Record<string, string> = {};

  files.forEach((file) => {
    if (file.type === 'folder') return;

    let current: FileRecord | undefined = file;
    const pathParts: string[] = [];

    while (current) {
      pathParts.unshift(current.name);
      if (current.parentId) {
        current = fileMap.get(current.parentId);
      } else {
        current = undefined;
      }
    }

    if (pathParts.length > 0) {
      paths[pathParts.join('/')] = file.content || '';
    }
  });

  return paths;
}
