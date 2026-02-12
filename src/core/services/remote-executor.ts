/**
 * RemoteExecutorService - Execute code on remote backend (Docker, isolated server).
 * Implements same ExecutorService interface for transparent swapping.
 *
 * This proves the SOA abstraction: UI doesn't care where code runs.
 * Can be enabled by:
 *   registry.register('executor', new RemoteExecutorService(logger, apiUrl))
 *
 * Future: Integrate with:
 *   - Docker API for real containerized execution
 *   - Kubernetes for distributed execution
 *   - AWS Lambda for serverless execution
 */

import type { ExecutionResult } from '../types'
import type { LoggerService } from './logger'

export interface ExecutionOptions {
  timeout?: number // ms
  env?: Record<string, string>
}

/**
 * Represents an API request to remote executor.
 */
interface ExecuteRequest {
  code: string
  timeout: number
  env?: Record<string, string>
}

/**
 * Represents an API response from remote executor.
 */
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

  /**
   * Execute code on remote backend.
   * Posts to: POST /api/execute
   * Body: { code: string, timeout: number, env?: Record<string, string> }
   * Response: { stdout: string, stderr: string, exitCode: number }
   */
  async execute(
    code: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    const timeout = options?.timeout ?? 5000
    const requestId = ++this.requestCount

    try {
      this.logger.debug(`[RemoteExecutor #${requestId}] Sending code to ${this.apiUrl}`)

      const request: ExecuteRequest = {
        code,
        timeout,
        env: options?.env || {}
      }

      const response = await fetch(`${this.apiUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': String(requestId)
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeout + 1000) // +1s buffer for network
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ExecuteResponse = await response.json()

      this.logger.debug(
        `[RemoteExecutor #${requestId}] Execution completed (exit ${data.exitCode})`
      )

      return {
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`[RemoteExecutor #${requestId}] Failed: ${message}`)
      throw new Error(`Remote execution failed: ${message}`)
    }
  }

  /**
   * Terminate any pending requests (cleanup on service shutdown).
   */
  terminate(): void {
    this.logger.debug('RemoteExecutorService terminated')
  }
}

/**
 * Example backend implementation (Node.js Express):
 *
 * ```typescript
 * import express from 'express';
 * import { spawn } from 'child_process';
 *
 * app.post('/api/execute', async (req, res) => {
 *   const { code, timeout, env } = req.body;
 *
 *   try {
 *     const result = await executeCode(code, timeout, { ...process.env, ...env });
 *     res.json(result);
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 *
 * async function executeCode(code, timeout, env) {
 *   return new Promise((resolve, reject) => {
 *     const proc = spawn('node', ['-e', code], {
 *       env,
 *       timeout,
 *       stdio: ['pipe', 'pipe', 'pipe']
 *     });
 *
 *     let stdout = '';
 *     let stderr = '';
 *
 *     proc.stdout.on('data', (data) => { stdout += data; });
 *     proc.stderr.on('data', (data) => { stderr += data; });
 *
 *     proc.on('close', (exitCode) => {
 *       resolve({ stdout, stderr, exitCode });
 *     });
 *
 *     proc.on('error', (error) => {
 *       reject(error);
 *     });
 *   });
 * }
 * ```
 *
 * Docker Example (using container-based executor):
 *
 * ```typescript
 * app.post('/api/execute', async (req, res) => {
 *   const { code, timeout, env } = req.body;
 *
 *   try {
 *     const container = await docker.createContainer({
 *       Image: 'node:18',
 *       Cmd: ['node', '-e', code],
 *       Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
 *       HostConfig: {
 *         Memory: 512 * 1024 * 1024, // 512MB
 *         MemorySwap: 512 * 1024 * 1024
 *       }
 *     });
 *
 *     await container.start();
 *     const result = await container.wait({ condition: 'next-exit' });
 *     const logs = await container.logs({ stdout: true, stderr: true });
 *
 *     await container.remove();
 *
 *     res.json({
 *       stdout: logs.toString('utf8'),
 *       stderr: '',
 *       exitCode: result.StatusCode
 *     });
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * ```
 */
