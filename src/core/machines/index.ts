/**
 * State machine factory with service injection.
 */

import { createActor } from 'xstate'
import { editorMachine } from './editor-machine'
import { allActors } from './actors'
import { initializeServices } from '../services'

export * from './editor-machine'
export * from './actors'
export { initializeServices }

/**
 * Create editor actor with injected services.
 * Call once per editor instance.
 */
export function createEditorActor() {
  return createActor(editorMachine, {
    actors: allActors
  }).start()
}
