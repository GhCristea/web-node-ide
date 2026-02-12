interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
}

interface WorkerMessage {
  type: 'EXECUTE' | 'ABORT'
  id: number
  code?: string
  env?: Record<string, string>
}

interface WorkerResponse {
  type: 'RESULT'
  id: number
  result?: ExecutionResult
  error?: string
}

let capturedOutput: { stdout: string; stderr: string } = { stdout: '', stderr: '' }

const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

const AsyncFunction = async function () {}.constructor as FunctionConstructor

function captureConsole(): void {
  capturedOutput = { stdout: '', stderr: '' }

  console.log = (...args: unknown[]) => {
    capturedOutput.stdout +=
      args
        .map(a => {
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' ') + '\n'
  }

  console.error = (...args: unknown[]) => {
    capturedOutput.stderr +=
      args
        .map(a => {
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' ') + '\n'
  }

  console.warn = console.error
}

function restoreConsole(): void {
  console.log = originalLog
  console.error = originalError
  console.warn = originalWarn
}

async function handleExecute(id: number, code: string, env: Record<string, string> = {}): Promise<WorkerResponse> {
  try {
    captureConsole()

    const asyncFn = new AsyncFunction('env', code)

    await asyncFn(env)

    restoreConsole()

    return {
      type: 'RESULT',
      id,
      result: { stdout: capturedOutput.stdout, stderr: capturedOutput.stderr, exitCode: 0 }
    }
  } catch (error) {
    restoreConsole()

    return { type: 'RESULT', id, error: error instanceof Error ? error.message : String(error) }
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, code, env } = event.data

  if (type === 'EXECUTE' && code) {
    const response = await handleExecute(id, code, env)
    self.postMessage(response)
  }
}

export type { WorkerMessage, WorkerResponse, ExecutionResult }
