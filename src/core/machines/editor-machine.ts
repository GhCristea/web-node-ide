import { createMachine } from 'xstate'

interface DoneActorEvent<TOutput = unknown> {
  type: string
  output: TOutput
}

interface ErrorActorEvent {
  type: string
  error: unknown
}

interface ExecutionOutput {
  stdout: string
  stderr: string
  exitCode: number
}

interface FileContent {
  content: string
}

interface FileSaveResult {
  timestamp: number
}

interface EditorContext {
  path: string
  content: string
  originalContent: string
  isDirty: boolean
  lastSaved: number | null
  error: string | null
}

type EditorEvent =
  | { type: 'OPEN'; path: string }
  | { type: 'MODIFY'; content: string }
  | { type: 'SAVE' }
  | { type: 'RUN' }
  | { type: 'CLOSE' }
  | { type: 'RESET_ERROR' }
  | DoneActorEvent<FileContent>
  | DoneActorEvent<ExecutionOutput>
  | DoneActorEvent<FileSaveResult>
  | ErrorActorEvent

export const editorMachine = createMachine(
  {
    id: 'editor',
    initial: 'idle',
    types: { context: {} as EditorContext, events: {} as EditorEvent },
    context: { path: '', content: '', originalContent: '', isDirty: false, lastSaved: null, error: null },
    states: {
      idle: { on: { OPEN: { target: 'loading', actions: 'setPath' } } },
      loading: {
        invoke: {
          src: 'load-file',
          input: ({ context }) => ({ path: context.path }),
          onDone: { target: 'editing', actions: 'setContent' },
          onError: { target: 'error', actions: 'setError' }
        }
      },
      editing: {
        on: {
          MODIFY: { actions: 'updateContent' },
          SAVE: { target: 'saving' },
          RUN: { target: 'executing' },
          CLOSE: { target: 'idle' }
        }
      },
      saving: {
        invoke: {
          src: 'save-file',
          input: ({ context }) => ({ path: context.path, content: context.content }),
          onDone: { target: 'editing', actions: 'markSaved' },
          onError: { target: 'error', actions: 'setError' }
        }
      },
      executing: {
        invoke: {
          src: 'execute-code',
          input: ({ context }) => ({ code: context.content }),
          onDone: { target: 'editing', actions: 'logExecution' },
          onError: { target: 'error', actions: 'setError' }
        }
      },
      error: { on: { RESET_ERROR: { target: 'editing' } } }
    },
    on: { RESET_ERROR: { actions: 'clearError' } }
  },
  {
    actions: {
      setPath: ({ context }, event) => {
        if (objHasKeys(event, ['type', 'path']) && event.type === 'OPEN' && typeof event.path === 'string') {
          context.path = event.path
        }
      },
      setContent: ({ context }, event) => {
        if (isDoneActorEvent<FileContent>(event)) {
          context.content = event.output.content
          context.originalContent = event.output.content
          context.isDirty = false
          context.error = null
        }
      },
      updateContent: ({ context }, event) => {
        if (
          objHasKeys(event, ['type', 'content']) &&
          event.type === 'MODIFY' &&
          typeof event.content === 'string'
        ) {
          context.content = event.content
          context.isDirty = context.content !== context.originalContent
        }
      },
      markSaved: ({ context }, event) => {
        if (isDoneActorEvent<FileSaveResult>(event)) {
          context.originalContent = context.content
          context.isDirty = false
          context.lastSaved = event.output.timestamp
          context.error = null
        }
      },
      logExecution: ({ context }, event) => {
        if (isDoneActorEvent<ExecutionOutput>(event)) {
          const result = event.output
          if (result.stderr) {
            console.error('[Execution]', result.stderr)
          }
          context.error = null
        }
      },
      setError: ({ context }, event) => {
        if (isErrorEvent(event, 'xstate.error.actor')) {
          context.error = event.error instanceof Error ? event.error.message : String(event.error)
        }
      },
      clearError: ({ context }) => {
        context.error = null
      }
    }
  }
)

function isErrorEvent(event: unknown, type: string): event is ErrorActorEvent {
  return event !== null && typeof event === 'object' && 'type' in event && event.type === type
}

function isDoneActorEvent<TOutput>(event: unknown): event is DoneActorEvent<TOutput> {
  return event !== null && typeof event === 'object' && 'type' in event && event.type === 'xstate.done.actor'
}

const objHasKeys = <K extends string>(o: unknown, keys: K[]): o is { [k in K]: unknown } => {
  const keysActual = typeof o === 'object' && o !== null ? Object.keys(o) : null
  return !!keysActual && keys.every(k => keysActual.includes(k))
}
