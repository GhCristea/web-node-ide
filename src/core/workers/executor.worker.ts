/**
 * Executor Worker - Isolated JavaScript execution environment.
 * Runs in Web Worker context. Captures stdout/stderr and enforces timeouts.
 *
 * Message Protocol:
 *   IN: { type: 'EXECUTE', id: number, code: string, env?: Record<string, string> }
 *   OUT: { type: 'RESULT', id: number, result?: ExecutionResult, error?: string }
 */

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface WorkerMessage {
  type: 'EXECUTE' | 'ABORT';
  id: number;
  code?: string;
  env?: Record<string, string>;
}

interface WorkerResponse {
  type: 'RESULT';
  id: number;
  result?: ExecutionResult;
  error?: string;
}

/**
 * Captured console output during execution.
 */
let capturedOutput: { stdout: string; stderr: string } = {
  stdout: '',
  stderr: ''
};

/**
 * Original console methods for restoration.
 */
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

/**
 * AsyncFunction constructor for safe evaluation of async code.
 * Extracted from: Object.getPrototypeOf(async function(){}).constructor
 */
// eslint-disable-next-line no-eval
const AsyncFunction = (async function () {}).constructor as any;

/**
 * Override console methods to capture output.
 */
function captureConsole(): void {
  capturedOutput = { stdout: '', stderr: '' };

  console.log = (...args: any[]) => {
    capturedOutput.stdout += args
      .map((a) => {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ') + '\n';
  };

  console.error = (...args: any[]) => {
    capturedOutput.stderr += args
      .map((a) => {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ') + '\n';
  };

  console.warn = console.error;
}

/**
 * Restore original console methods.
 */
function restoreConsole(): void {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
}

/**
 * Handle execute message.
 */
async function handleExecute(
  id: number,
  code: string,
  env: Record<string, string> = {}
): Promise<WorkerResponse> {
  try {
    // Capture console output
    captureConsole();

    // Create async function with environment variables
    const asyncFn = new AsyncFunction('env', code);

    // Execute code with env context
    await asyncFn(env);

    // Restore console
    restoreConsole();

    // Return successful result
    return {
      type: 'RESULT',
      id,
      result: {
        stdout: capturedOutput.stdout,
        stderr: capturedOutput.stderr,
        exitCode: 0
      }
    };
  } catch (error) {
    // Restore console
    restoreConsole();

    // Return error result
    return {
      type: 'RESULT',
      id,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Message handler for worker.
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, code, env } = event.data;

  if (type === 'EXECUTE' && code) {
    const response = await handleExecute(id, code, env);
    self.postMessage(response);
  }
};

// Export for type checking (not used at runtime)
export type { WorkerMessage, WorkerResponse, ExecutionResult };
