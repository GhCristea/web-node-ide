import type { ExecutionResult } from '../types'
import type { LoggerService } from './logger'
import ExecutorWorker from '../workers/executor.worker?worker'
import type { WorkerResponse } from '../workers/executor.worker'

export interface ExecutionOptions {
  timeout?: number
  env?: Record<string, string>
}

export class ExecutorService {
  private worker: Worker | null = null
  private logger: LoggerService
  private requestId = 0
  private pending: Map<
    number,
    { resolve: (result: ExecutionResult) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
  > = new Map()

  constructor(logger: LoggerService) {
    this.logger = logger
  }

  private async initWorker(): Promise<void> {
    if (this.worker) return

    try {
      this.worker = new ExecutorWorker()

      this.worker.onmessage = event => {
        this.handleWorkerMessage(event.data)
      }

      this.worker.onerror = error => {
        this.logger.error(`Worker error: ${error.message}`)

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

  async execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    await this.initWorker()

    const timeout = options?.timeout ?? 5000
    const id = this.requestId++

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Execution timeout (${timeout}ms)`))

        this.worker?.postMessage({ type: 'ABORT', id })
      }, timeout)

      this.pending.set(id, { resolve, reject, timeout: timeoutHandle })

      this.worker!.postMessage({ type: 'EXECUTE', id, code, env: options?.env || {} })
    })
  }

  private handleWorkerMessage(message: WorkerResponse): void {
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
      resolve(result!)
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pending.forEach(({ timeout }) => clearTimeout(timeout))
    this.pending.clear()
  }
}
