/**
 * Application entry point - vanilla JavaScript.
 * Initialize services, create machine actor, mount UI components.
 */

import { initializeServices, createEditorActor } from './core/machines'
import { EditorComponent, FileTreeComponent, OutputPanelComponent } from './ui'
import type { ExecutionResult } from './ui'
import { registry } from './core/services'
import type { NotificationService, LoggerService, FileSystemService } from './core/services'
import type { FileSystemTree } from './core/types'
import './style.css'

// Demo project files (WebContainers format)
const demoProject: FileSystemTree = {
  'package.json': {
    file: {
      contents: `{
  "name": "web-node-ide-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/main.js"
  }
}`,
    },
  },
  'src': {
    directory: {
      'main.js': {
        file: {
          contents: `console.log('Hello from web-node-ide!');
console.log('Timestamp:', new Date().toISOString());`,
        },
      },
      'utils.js': {
        file: {
          contents: `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}`,
        },
      },
    },
  },
  'README.md': {
    file: {
      contents: `# web-node-ide Demo

This is a demo project for the web-based Node.js IDE.

## Features

- File tree navigation
- Code editor
- Real-time execution
- Output panel

## Getting started

Select a file from the left sidebar to edit it.`,
    },
  },
}

// 1. Initialize service registry
await initializeServices()

const filesystem = registry.get<FileSystemService>('filesystem')
const logger = registry.get<LoggerService>('logger')
const notification = registry.get<NotificationService>('notification')

// 2. Mount demo files into filesystem
await filesystem.mount(demoProject)
logger.log('Filesystem initialized with demo project')

// 3. Create editor state machine actor
const editorActor = createEditorActor()

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

const fileTree = new FileTreeComponent(sidebarEl, filesystem)
const editor = new EditorComponent(editorActor, editorPaneEl)
const outputPanel = new OutputPanelComponent(outputPaneEl)

// Wire up FileTree to Editor
sidebarEl.addEventListener('file-select', ((e: any) => {
  const path = e.detail.path
  logger.log(`Opening file: ${path}`)
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
notification.subscribe((toasts) => {
  toasts.forEach((toast) => {
    outputPanel.addLog(
      toast.type === 'error' ? 'error' : 'log',
      `[${toast.type.toUpperCase()}] ${toast.message}`
    )
  })
})

// Add initial log
outputPanel.addLog('log', 'web-node-ide initialized')
outputPanel.addLog('log', 'Demo project loaded')

// 5. Cleanup on page unload
window.addEventListener('beforeunload', () => {
  editor.destroy()
  editorActor.stop()
})
