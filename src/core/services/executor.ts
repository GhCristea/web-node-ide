/**
 * ExecutorService - Execute Node.js code in Web Worker.
 * Provides async execution with stdout/stderr capture and timeout protection.
 *
 * Architecture:
 *   - Lazy initializes Web Worker on first execution
 *   - Timeout protection via scheduled abort messages
 *   - Swappable: Can be replaced with RemoteExecutorService for Docker backend
 */

import type { ExecutionResult } from '../types'
import type { LoggerService } from './logger'
import ExecutorWorker from '../workers/executor.worker?worker';

export interface ExecutionOptions {
  timeout?: number // ms
  env?: Record<string, string>
}

export class ExecutorService {
  private worker: Worker | null = null
  private logger: LoggerService
  private requestId = 0
  private pending: Map<number, {
    resolve: (result: ExecutionResult) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = new Map()

  constructor(logger: LoggerService) {
    this.logger = logger
  }

  /**
   * Initialize worker (lazy loaded on first execution).
   */
  private async initWorker(): Promise<void> {
    if (this.worker) return

    try {
      // Import worker using Vite's ?worker query parameter
      // This ensures proper bundling and typescript checking
      this.worker = new ExecutorWorker()

      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data)
      }

      this.worker.onerror = (error) => {
        this.logger.error(`Worker error: ${error.message}`)
        // Reject all pending requests
        this.pending.forEach(({ reject, timeout }) => {
          clearTimeout(timeout)
          reject(new Error('Worker crashed'))
        })
        this.pending.clear()
        this.worker = null
      }
    } catch (error) {
      throw new Error(`Failed to initialize worker: ${(error as Error).message}`)
    }
  }

  /**
   * Execute code string with optional environment variables.
   * @param code - JavaScript/TypeScript code to execute
   * @param options - Execution options (timeout, env variables)
   * @returns Promise resolving to ExecutionResult with stdout/stderr
   */
  async execute(
    code: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    await this.initWorker()

    const timeout = options?.timeout ?? 5000
    const id = this.requestId++

    return new Promise((resolve, reject) => {
      // Set up timeout handler
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Execution timeout (${timeout}ms)`))
        // Send abort signal to worker
        this.worker?.postMessage({ type: 'ABORT', id })
      }, timeout)

      // Store promise handlers for when worker responds
      this.pending.set(id, { resolve, reject, timeout: timeoutHandle })

      // Send execution request to worker
      this.worker!.postMessage({
        type: 'EXECUTE',
        id,
        code,
        env: options?.env || {}
      })
    })
  }

  /**
   * Handle message from worker.
   */
  private handleWorkerMessage(message: any): void {
    const { type, id, result, error } = message

    if (type !== 'RESULT') return

    const pending = this.pending.get(id)
    if (!pending) return

    const { resolve, reject, timeout } = pending
    clearTimeout(timeout)
    this.pending.delete(id)

    if (error) {
      reject(new Error(error))
    } else {
      resolve(result as ExecutionResult)
    }
  }

  /**
   * Terminate worker and clean up resources.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pending.forEach(({ timeout }) => clearTimeout(timeout))
    this.pending.clear()
  }
}
