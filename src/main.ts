/**
 * Application entry point - vanilla JavaScript.
 * Initialize services, create machine actor, mount UI components.
 */

import { initializeServices, createEditorActor } from './core/machines'
import { EditorComponent, FileTreeComponent, OutputPanelComponent } from './ui'
import type { ExecutionResult } from './ui'
import { registry } from './core/services'
import type { NotificationService, LoggerService } from './core/services'
import './style.css'

// 1. Initialize service registry
initializeServices()

// 2. Create editor state machine actor
const editorActor = createEditorActor()

// 3. Get services
const notificationService = registry.get<NotificationService>('notification')
const loggerService = registry.get<LoggerService>('logger')

// 4. Mount UI components in layout
const container = document.getElementById('app')
if (!container) {
  throw new Error('Root #app element not found')
}

// Create layout
container.innerHTML = `
  <div class="app-layout">
    <div id="sidebar" class="sidebar"></div>
    <div id="main-area" class="main-area">
      <div id="editor-pane" class="editor-pane"></div>
      <div id="output-pane" class="output-pane"></div>
    </div>
  </div>
`

// Initialize components
const sidebarEl = document.getElementById('sidebar') as HTMLElement
const editorPaneEl = document.getElementById('editor-pane') as HTMLElement
const outputPaneEl = document.getElementById('output-pane') as HTMLElement

const fileTree = new FileTreeComponent(sidebarEl)
const editor = new EditorComponent(editorActor, editorPaneEl)
const outputPanel = new OutputPanelComponent(outputPaneEl)

// Wire up FileTree to Editor
sidebarEl.addEventListener('file-select', ((e: any) => {
  const path = e.detail.path
  loggerService.log(`Opening file: ${path}`)
  editorActor.send({ type: 'OPEN', path })
}) as EventListener)

// Wire up execution results to OutputPanel
editorActor.subscribe((snapshot) => {
  const state = snapshot.value
  // When execution completes, check result
  if (typeof state === 'object' && state.editing === true && snapshot.context.lastSaved) {
    outputPanel.addLog('log', 'Ready')
  }
})

// Listen for notifications
notificationService.subscribe((toasts) => {
  toasts.forEach((toast) => {
    outputPanel.addLog(
      toast.type === 'error' ? 'error' : 'log',
      `[${toast.type.toUpperCase()}] ${toast.message}`
    )
  })
})

// Add initial log
outputPanel.addLog('log', 'web-node-ide initialized')

// 5. Cleanup on page unload
window.addEventListener('beforeunload', () => {
  editor.destroy()
  editorActor.stop()
})
