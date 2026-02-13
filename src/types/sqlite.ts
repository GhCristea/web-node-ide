export interface SqlitePromiser {
  (command: 'exec', params: ExecParams): Promise<ExecResult>
  (command: 'open', params: OpenParams): Promise<OpenResult>
}

interface ExecParams {
  sql: string
  bind?: unknown[]
  rowMode?: 'object' | 'array'
  dbId: string | null
}

interface ExecResult {
  result: { resultRows?: Array<Record<string, unknown>> }
}

interface OpenParams {
  filename: string
}

interface OpenResult {
  result: { dbId: string; filename: string }
}
