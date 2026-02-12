import { initializeServices, createEditorActor } from './core/machines'
import { EditorComponent, FileTreeComponent, OutputPanelComponent } from './ui'
import { registry } from './core/services'
import type { NotificationService, LoggerService, FileSystemService } from './core/services'
import type { FileSystemTree } from './core/types'
import './style.css'

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
}`
    }
  },
  src: {
    directory: {
      'main.js': {
        file: {
          contents: `console.log('Hello from web-node-ide!');
console.log('Timestamp:', new Date().toISOString());`
        }
      },
      'utils.js': {
        file: {
          contents: `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}`
        }
      }
    }
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

Select a file from the left sidebar to edit it.`
    }
  }
}

await initializeServices()

const filesystem = registry.get<FileSystemService>('filesystem')
const logger = registry.get<LoggerService>('logger')
const notification = registry.get<NotificationService>('notification')

await filesystem.mount(demoProject)
logger.log('Filesystem initialized with demo project')

const editorActor = createEditorActor()

const container = document.getElementById('app')
if (!container) {
  throw new Error('Root #app element not found')
}

container.innerHTML = `
  <div class="app-layout">
    <div id="sidebar" class="sidebar"></div>
    <div id="main-area" class="main-area">
      <div id="editor-pane" class="editor-pane"></div>
      <div id="output-pane" class="output-pane"></div>
    </div>
  </div>
`

const sidebarEl = document.getElementById('sidebar') as HTMLElement
const editorPaneEl = document.getElementById('editor-pane') as HTMLElement
const outputPaneEl = document.getElementById('output-pane') as HTMLElement

new FileTreeComponent(sidebarEl, filesystem)
const editor = new EditorComponent(editorActor, editorPaneEl)
const outputPanel = new OutputPanelComponent(outputPaneEl)

sidebarEl.addEventListener('file-select', ((e: Event) => {
  const path = (e as CustomEvent).detail.path
  logger.log(`Opening file: ${path}`)
  editorActor.send({ type: 'OPEN', path })
}) as EventListener)

editorActor.subscribe(snapshot => {
  if (snapshot.matches('editing') && snapshot.context.lastSaved) {
    outputPanel.addLog('log', 'Ready')
  }
})

notification.subscribe(toasts => {
  toasts.forEach(toast => {
    outputPanel.addLog(toast.type === 'error' ? 'error' : 'log', `[${toast.type.toUpperCase()}] ${toast.message}`)
  })
})

outputPanel.addLog('log', 'web-node-ide initialized')
outputPanel.addLog('log', 'Demo project loaded')

window.addEventListener('beforeunload', () => {
  editor.destroy()
  editorActor.stop()
})
