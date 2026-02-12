/**
 * Editor machine - manages file editing and code execution.
 * States: idle, loading, editing, saving, executing
 * 
 * Type-safe event handling: All actions infer correct event types from union.
 */

import { createMachine, DoneActorEvent, ErrorActorEvent } from 'xstate';

// Execution result from executor service
interface ExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// File content from filesystem service
interface FileContent {
  content: string;
}

// Filesystem save result
interface FileSaveResult {
  timestamp: number;
}

// Machine context with full type safety
interface EditorContext {
  path: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  lastSaved: number | null;
  error: string | null;
}

// Event union with explicit types for each event
type EditorEvent =
  | { type: 'OPEN'; path: string }
  | { type: 'MODIFY'; content: string }
  | { type: 'SAVE' }
  | { type: 'RUN' }
  | { type: 'CLOSE' }
  | { type: 'RESET_ERROR' }
  | DoneActorEvent<FileContent>  // onDone from load-file actor
  | DoneActorEvent<ExecutionOutput>  // onDone from execute-code actor
  | DoneActorEvent<FileSaveResult>  // onDone from save-file actor
  | ErrorActorEvent;  // onError from any actor

export const editorMachine = createMachine(
  {
    id: 'editor',
    initial: 'idle',
    types: {
      context: {} as EditorContext,
      events: {} as EditorEvent,
    },
    context: {
      path: '',
      content: '',
      originalContent: '',
      isDirty: false,
      lastSaved: null,
      error: null
    },
    states: {
      idle: {
        on: {
          OPEN: { target: 'loading', actions: 'setPath' }
        }
      },
      loading: {
        invoke: {
          src: 'load-file',
          input: ({ context }) => ({ path: context.path }),
          onDone: {
            target: 'editing',
            actions: 'setContent'
          },
          onError: {
            target: 'error',
            actions: 'setError'
          }
        }
      },
      editing: {
        on: {
          MODIFY: {
            actions: 'updateContent'
          },
          SAVE: { target: 'saving' },
          RUN: { target: 'executing' },
          CLOSE: { target: 'idle' }
        }
      },
      saving: {
        invoke: {
          src: 'save-file',
          input: ({ context }) => ({
            path: context.path,
            content: context.content
          }),
          onDone: {
            target: 'editing',
            actions: 'markSaved'
          },
          onError: {
            target: 'error',
            actions: 'setError'
          }
        }
      },
      executing: {
        invoke: {
          src: 'execute-code',
          input: ({ context }) => ({ code: context.content }),
          onDone: {
            target: 'editing',
            actions: 'logExecution'
          },
          onError: {
            target: 'error',
            actions: 'setError'
          }
        }
      },
      error: {
        on: {
          RESET_ERROR: { target: 'editing' }
        }
      }
    },
    on: {
      RESET_ERROR: {
        actions: 'clearError'
      }
    }
  },
  {
    actions: {
      setPath: ({ context }, event) => {
        // Type-safe: event.type is narrowed to 'OPEN', so event.path exists
        if (event.type === 'OPEN') {
          context.path = event.path;
        }
      },
      setContent: ({ context }, event) => {
        // Type-safe: event is DoneActorEvent<FileContent>
        if (event.type === 'xstate.done.actor') {
          context.content = event.output.content;
          context.originalContent = event.output.content;
          context.isDirty = false;
          context.error = null;
        }
      },
      updateContent: ({ context }, event) => {
        // Type-safe: event.type is narrowed to 'MODIFY'
        if (event.type === 'MODIFY') {
          context.content = event.content;
          context.isDirty = context.content !== context.originalContent;
        }
      },
      markSaved: ({ context }, event) => {
        // Type-safe: event is DoneActorEvent<FileSaveResult>
        if (event.type === 'xstate.done.actor') {
          context.originalContent = context.content;
          context.isDirty = false;
          context.lastSaved = event.output.timestamp;
          context.error = null;
        }
      },
      logExecution: ({ context }, event) => {
        // Type-safe: event is DoneActorEvent<ExecutionOutput>
        if (event.type === 'xstate.done.actor') {
          const result = event.output;
          if (result.stderr) {
            console.error('[Execution]', result.stderr);
          }
          context.error = null;
        }
      },
      setError: ({ context }, event) => {
        // Type-safe: event is ErrorActorEvent
        if (event.type === 'xstate.error.actor') {
          context.error = event.error instanceof Error 
            ? event.error.message 
            : String(event.error);
        }
      },
      clearError: ({ context }) => {
        context.error = null;
      }
    }
  }
);
