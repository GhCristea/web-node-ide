import type { ExecutionResult } from '../types'
import type { LoggerService } from './logger'

export interface ExecutionOptions {
  timeout?: number
  env?: Record<string, string>
}

interface ExecuteRequest {
  code: string
  timeout: number
  env?: Record<string, string>
}

interface ExecuteResponse {
  stdout: string
  stderr: string
  exitCode: number
}

export class RemoteExecutorService {
  private logger: LoggerService
  private apiUrl: string
  private requestCount = 0

  constructor(logger: LoggerService, apiUrl: string) {
    this.logger = logger
    this.apiUrl = apiUrl
  }

  async execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    const timeout = options?.timeout ?? 5000
    const requestId = ++this.requestCount

    try {
      this.logger.debug(`[RemoteExecutor #${requestId}] Sending code to ${this.apiUrl}`)

      const request: ExecuteRequest = { code, timeout, env: options?.env || {} }

      const response = await fetch(`${this.apiUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': String(requestId) },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeout + 1000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ExecuteResponse = await response.json()

      this.logger.debug(`[RemoteExecutor #${requestId}] Execution completed (exit ${data.exitCode})`)

      return { stdout: data.stdout, stderr: data.stderr, exitCode: data.exitCode }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`[RemoteExecutor #${requestId}] Failed: ${message}`)
      throw new Error(`Remote execution failed: ${message}`)
    }
  }

  terminate(): void {
    this.logger.debug('RemoteExecutorService terminated')
  }
}
