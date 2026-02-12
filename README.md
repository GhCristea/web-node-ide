# web-node-ide

A lightweight, web-based IDE for Node.js script development. Built with vanilla TypeScript, XState for state management, and WebContainers-compatible file system.

**Zero React. Pure composition.**

## ✨ Features

- 📁 **Virtual File System** - IndexedDB-backed, WebContainers compatible
- ⚡ **Code Execution** - Web Worker isolation, real-time output capture
- 🎨 **Vanilla UI** - No framework, pure DOM and CSS
- 🔧 **Service-Oriented** - Modular, testable architecture
- 🎯 **State Machine** - XState for predictable state management
- 📝 **Multi-pane Layout** - Sidebar (files) + Editor + Output

## 🚀 Quick Start

### Install

```bash
git clone https://github.com/GhCristea/web-node-ide.git
cd web-node-ide
npm install
```

### Develop

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design overview
- **[SERVICES.md](./docs/SERVICES.md)** - Service architecture and API
- **[FILESYSTEM.md](./docs/FILESYSTEM.md)** - FileSystemService guide

## 🏗️ Architecture

### Three Layers

```
UI Components (Vanilla JS)
        ↓
State Machine (XState)
        ↓
Services (Dependency Injection)
```

**UI Components** (no framework):
- `EditorComponent` - Code editor with execution controls
- `FileTreeComponent` - Virtual file system tree view
- `OutputPanelComponent` - Execution results display

**State Machine** (XState):
- Manages editor state: idle → loading → editing → saving → executing
- Immutable context: file path, content, logs, errors
- Explicit transitions prevent invalid states

**Services** (Dependency Injection):
- `FileSystemService` - Virtual FS (IndexedDB)
- `ExecutorService` - Code execution (Web Worker)
- `LoggerService` - Structured logging
- `NotificationService` - Toast notifications

## 📂 Project Structure

```
src/
├── core/
│   ├── machines/
│   │   ├── editor.ts           # State machine definition
│   │   └── index.ts            # Machine creation
│   ├── services/
│   │   ├── filesystem.ts       # Virtual file system
│   │   ├── executor.ts         # Code execution
│   │   ├── logger.ts           # Structured logging
│   │   ├── notification.ts     # Toast notifications
│   │   ├── registry.ts         # DI container
│   │   └── index.ts            # Service exports
│   └── types.ts                # Shared TypeScript types
├── ui/
│   ├── editor.ts               # Editor component
│   ├── file-tree.ts            # File tree component
│   ├── output-panel.ts         # Output display component
│   └── index.ts                # Component exports
├── main.ts                      # App entry point
├── style.css                    # Global styles
└── index.html                   # HTML shell
```

## 🎯 Usage

### Open and Edit a File

1. Click a file in the sidebar
2. File content loads into editor
3. Edit code
4. Click **Save** to persist (or Ctrl+S)

### Execute Code

1. Click **Run** button
2. Code executes in Web Worker
3. Output appears in bottom panel
4. Execution errors shown as toast notification

### Create/Delete Files

```typescript
const fs = registry.get('filesystem')

// Create file
await fs.writeFile('/new-file.js', 'console.log("hello")')

// Delete file
await fs.rm('/new-file.js')
```

## 🔌 Extending

### Add a New Service

```typescript
// 1. Create service
export class MyService {
  doSomething() { }
}

// 2. Register in src/core/services/registry.ts
const myService = new MyService()
registry.register('myservice', myService)

// 3. Use in components
const myService = registry.get('myservice')
```

### Add a New Component

```typescript
// 1. Create component
export class MyComponent {
  constructor(container: HTMLElement) {
    this.render()
  }
  private render() { }
}

// 2. Mount in main.ts
const component = new MyComponent(container)

// 3. Wire events
container.addEventListener('my-event', handler)
```

### Swap FileSystemService

```typescript
// Create adapter
export class WebContainersFS extends FileSystemService {
  async readFile(path: string) {
    // Use WebContainers API
  }
}

// Register
const fs = new WebContainersFS()
registry.register('filesystem', fs)
```

## 🧪 Testing

### Service Unit Tests

```typescript
import { FileSystemService } from './services/filesystem'

test('writes and reads file', async () => {
  const fs = new FileSystemService()
  await fs.initialize()
  
  await fs.writeFile('/test.js', 'hello')
  const content = await fs.readFile('/test.js', 'utf-8')
  
  expect(content).toBe('hello')
})
```

### Component Testing

```typescript
import { EditorComponent } from './ui/editor'

test('renders editor', () => {
  const container = document.createElement('div')
  const component = new EditorComponent(actor, container)
  
  expect(container.querySelector('.editor')).toBeTruthy()
})
```

## 🚦 Status

✅ Core architecture complete
- [x] Service-oriented design
- [x] XState state machine
- [x] Vanilla UI components
- [x] FileSystemService (IndexedDB)
- [x] ExecutorService (Web Worker)
- [x] LoggerService
- [x] NotificationService

🔄 In Progress
- [ ] Syntax highlighting (highlight.js)
- [ ] Keyboard shortcuts
- [ ] File search (Ctrl+P)
- [ ] Command palette
- [ ] Multi-tab editor
- [ ] Integrated terminal
- [ ] WebContainers integration

## 📝 License

MIT

## 🙋 Contributing

Contributions welcome! Please ensure:
- No React framework
- Vanilla JS/TS only
- Service-oriented design maintained
- Documentation updated
