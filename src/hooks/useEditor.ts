/**
 * useEditor hook - Connect React component to editor state machine.
 */

import { useEffect, useState } from 'react';
import type { Actor } from 'xstate';
import { createEditorActor } from '../core/machines';
import type { editorMachine } from '../core/machines/editor-machine';

export function useEditor() {
  const [actor, setActor] = useState<Actor<typeof editorMachine> | null>(null);
  const [state, setState] = useState(actor?.getSnapshot());

  // Initialize actor on mount
  useEffect(() => {
    const newActor = createEditorActor();
    setActor(newActor);

    // Subscribe to state changes
    const unsubscribe = newActor.subscribe((snapshot) => {
      setState(snapshot);
    });

    return () => {
      unsubscribe();
      newActor.stop();
    };
  }, []);

  return {
    actor,
    state,
    // Convenience methods
    send: (event: any) => actor?.send(event),
    isLoading: state?.matches('loading'),
    isEditing: state?.matches('editing'),
    isSaving: state?.matches('saving'),
    isExecuting: state?.matches('executing'),
    isError: state?.matches('error'),
    context: state?.context
  };
}
