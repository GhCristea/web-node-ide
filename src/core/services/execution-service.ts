/**
 * ExecutionService for running user code in web worker.
 * Isolates execution environment from main thread.
 */

import type { ExecutionService } from './types';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ExecutionServiceImpl implements ExecutionService {
  private worker: Worker | null = null;
  private currentExecution: Promise<ExecutionResult> | null = null;
  private abortController: AbortController | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      // Simple inline worker for now
      // TODO: Move to separate executor-worker.ts file
      const workerCode = `
        self.onmessage = async (event) => {
          const { code } = event.data;
          const stdout: string[] = [];
          const stderr: string[] = [];

          const originalLog = console.log;
          const originalError = console.error;

          console.log = (...args: any[]) => {
            stdout.push(args.map(a => String(a)).join(' '));
            originalLog(...args);
          };

          console.error = (...args: any[]) => {
            stderr.push(args.map(a => String(a)).join(' '));
            originalError(...args);
          };

          try {
            const fn = new Function(code);
            await fn();
            self.postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n'), exitCode: 0 });
          } catch (error) {
            stderr.push(error instanceof Error ? error.message : String(error));
            self.postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n'), exitCode: 1 });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
    }
    return this.worker;
  }

  async executeCode(code: string): Promise<ExecutionResult> {
    // Cancel previous execution if still running
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();

    this.currentExecution = new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, 5000); // 5 second timeout

      const handler = (event: MessageEvent) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
        resolve(event.data as ExecutionResult);
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ code });
    });

    return this.currentExecution;
  }

  async stopExecution(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
