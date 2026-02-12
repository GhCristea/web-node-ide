/**
 * ExecutorService - Execute Node.js code in Web Worker.
 * Provides async execution with stdout/stderr capture.
 */

import type { ExecutionResult } from '../types'
import type { LoggerService } from './logger'

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
   * Initialize worker (lazy loaded).
   */
  private async initWorker(): Promise<void> {
    if (this.worker) return

    try {
      // Create inline worker from base64-encoded code
      // In production, use: new Worker('/workers/executor.worker.ts')
      const workerCode = this.getWorkerCode()
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      this.worker = new Worker(url)

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
   * Execute code string.
   */
  async execute(
    code: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    await this.initWorker()

    const timeout = options?.timeout ?? 5000
    const id = this.requestId++

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Execution timeout (${timeout}ms)`))
        // Send abort signal to worker
        this.worker?.postMessage({ type: 'ABORT', id })
      }, timeout)

      // Store promise handlers
      this.pending.set(id, { resolve, reject, timeout: timeoutHandle })

      // Send to worker
      this.worker!.postMessage({
        type: 'EXECUTE',
        id,
        code,
        env: options?.env || {}
      })
    })
  }

  /**
   * Handle worker response.
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
   * Generate worker code (inline for simplicity).
   * In production, use separate worker file.
   */
  private getWorkerCode(): string {
    return `
      let capturedOutput = { stdout: '', stderr: '' };
      let originalLog = console.log;
      let originalError = console.error;
      let originalWarn = console.warn;

      self.onmessage = async (event) => {
        const { type, id, code, env } = event.data;

        if (type === 'EXECUTE') {
          try {
            // Reset output capture
            capturedOutput = { stdout: '', stderr: '' };

            // Override console methods
            console.log = (...args) => {
              capturedOutput.stdout += args.map(a => {
                try {
                  return JSON.stringify(a);
                } catch {
                  return String(a);
                }
              }).join(' ') + '\\n';
            };

            console.error = (...args) => {
              capturedOutput.stderr += args.map(a => {
                try {
                  return JSON.stringify(a);
                } catch {
                  return String(a);
                }
              }).join(' ') + '\\n';
            };

            console.warn = console.error;

            // Create async function and execute
            const asyncFn = new AsyncFunction('env', code);
            await asyncFn(env || {});

            // Restore console
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;

            // Send result
            self.postMessage({
              type: 'RESULT',
              id,
              result: {
                stdout: capturedOutput.stdout,
                stderr: capturedOutput.stderr,
                exitCode: 0
              }
            });
          } catch (error) {
            // Restore console
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;

            // Send error
            self.postMessage({
              type: 'RESULT',
              id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      };

      // AsyncFunction constructor for executing async code
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    `
  }

  /**
   * Terminate worker.
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
