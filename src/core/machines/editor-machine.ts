/**
 * Editor machine - manages file editing and code execution.
 * States: idle, loading, editing, saving, executing
 */

import { createMachine } from 'xstate';

export const editorMachine = createMachine(
  {
    id: 'editor',
    initial: 'idle',
    types: {
      context: {} as {
        path: string;
        content: string;
        originalContent: string;
        isDirty: boolean;
        lastSaved: number | null;
        error: string | null;
      },
      events: {} as
        | { type: 'OPEN'; path: string }
        | { type: 'MODIFY'; content: string }
        | { type: 'SAVE' }
        | { type: 'RUN' }
        | { type: 'CLOSE' }
        | { type: 'RESET_ERROR' },
      actors: {
        'load-file': 'load-file-actor';
        'save-file': 'save-file-actor';
        'execute-code': 'execute-code-actor';
      }
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
          OPEN: { target: 'loading' }
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
      setContent: (
        { context },
        event: any
      ) => {
        context.content = event.output.content;
        context.originalContent = event.output.content;
        context.isDirty = false;
        context.error = null;
      },
      updateContent: ({ context }, event: any) => {
        context.content = event.content;
        context.isDirty = context.content !== context.originalContent;
      },
      markSaved: ({ context }, event: any) => {
        context.originalContent = context.content;
        context.isDirty = false;
        context.lastSaved = event.output.timestamp;
        context.error = null;
      },
      logExecution: ({ context }, event: any) => {
        const logger = console; // Will be injected
        logger.log('[Machine] Execution result:', event.output);
        context.error = null;
      },
      setError: ({ context }, event: any) => {
        context.error =
          event.error instanceof Error ? event.error.message : String(event.error);
      },
      clearError: ({ context }) => {
        context.error = null;
      }
    }
  }
);
