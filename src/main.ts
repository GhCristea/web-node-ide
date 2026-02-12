/**
 * Application entry point - vanilla JavaScript.
 * Initialize services, create machine actor, mount UI.
 */

import { initializeServices, createEditorActor } from './core/machines'
import { EditorComponent } from './ui'
import './style.css'

// 1. Initialize service registry
initializeServices()

// 2. Create editor state machine actor
const editorActor = createEditorActor()

// 3. Mount UI component
const container = document.getElementById('app')
if (!container) {
  throw new Error('Root #app element not found')
}

const editor = new EditorComponent(editorActor, container)

// 4. Cleanup on page unload
window.addEventListener('beforeunload', () => {
  editor.destroy()
  editorActor.stop()
})
