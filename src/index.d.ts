declare module '@sqlite.org/sqlite-wasm' {
  export type Id = string

  export interface SqlitePromiser<T> {
    (command: 'exec', params: ExecParams): Promise<ExecResult<T>>
    (command: 'open', params: OpenParams): Promise<OpenResult>
  }

  interface ExecParams {
    sql: string
    bind?: unknown[]
    rowMode?: 'object' | 'array'
    dbId: Id | null
  }

  interface ExecResult<T> {
    result: { resultRows?: T[] }
  }

  interface OpenParams {
    filename: string
  }

  interface OpenResult {
    result: { dbId: Id; filename: string }
  }

  export function sqlite3Worker1Promiser(...args: unknown[]): SqlitePromiser | PromiseLike<SqlitePromiser>
}
