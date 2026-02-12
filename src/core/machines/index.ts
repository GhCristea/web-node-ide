import { createActor } from 'xstate'
import { editorMachine } from './editor-machine'
import { allActors } from './actors'
import { initializeServices } from '../services'

export * from './editor-machine'
export * from './actors'
export { initializeServices }

export function createEditorActor() {
  const machine = editorMachine.provide({ actors: allActors })
  return createActor(machine).start()
}
