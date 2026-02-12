# web-node-ide Architecture

## Overview

A monolithic yet modular web-based IDE for Node.js script development, built with **vanilla JavaScript** (TypeScript) and XState for state management. No React framework dependency.

## Design Principles

- **Service-Oriented**: Core business logic isolated in services, independent of UI
- **Composition**: Small, focused classes/modules that compose into larger systems
- **Decoupling**: UI components communicate via events and state subscriptions
- **No Framework**: Vanilla DOM manipulation with semantic HTML

## Architecture Layers

### Layer 1: Core State Machine (`/core/machines`)

**Module**: `editor.ts` - XState state machine for editor state management

```
State Flow:
  idle → loading → editing ⇆ saving ⇆ executing
        ↓
      error (any state)
```

**Context** (immutable state):
- `currentPath`: string - active file path
- `content`: string - editor content
- `lastSaved`: string - last saved content
- `logs`: Array - execution logs
- `error`: string | null - error message

**Events**:
- `OPEN` - Open a file
- `EDIT` - Update editor content
- `SAVE` - Save to file
- `EXECUTE` - Run Node.js script
- `CLEAR_ERROR` - Dismiss error

### Layer 2: Service Registry (`/core/services`)

**Services** (singleton instances, dependency injection pattern):

```typescript
interface ServiceRegistry {
  logger: LoggerService
  notification: NotificationService
  executor: ExecutorService
  fileSystem: FileSystemService
}
```

#### Service Contracts

**LoggerService**
```typescript
log(message: string): void
error(message: string): void
debug(message: string): void
getLogs(): LogEntry[]
```

**NotificationService**
```typescript
show(message: string, type: 'info' | 'error'): void
subscribe(callback: (toasts: Toast[]) => void): void
```

**ExecutorService** (Node.js execution)
```typescript
execute(code: string): Promise<ExecutionResult>
// ExecutionResult: { stdout, stderr, exitCode }
```

**FileSystemService** (Virtual FS, IndexedDB or similar)
```typescript
read(path: string): Promise<string>
write(path: string, content: string): Promise<void>
list(dir: string): Promise<FileEntry[]>
delete(path: string): Promise<void>
```

### Layer 3: UI Components (`/ui`)

**Components** (vanilla JavaScript, no framework):

#### EditorComponent
- Renders textarea with syntax highlighting (optional)
- Listens to state machine updates
- Emits EDIT events on content change
- Displays status badges (saving, executing, error)

#### FileTreeComponent
- Renders virtual file system in a tree
- Handles expand/collapse state locally
- Emits `file-select` custom events
- Shows loading/error states

#### OutputPanelComponent
- Displays execution logs (stdout, stderr, exit code)
- Appends logs to scrollable container
- Supports log clearing
- Color-coded output types

#### LayoutManager (main.ts)
- Initializes services
- Creates state machine actor
- Mounts components
- Wires event listeners

## Data Flow

### File Selection → Edit → Execute

```
FileTreeComponent
  ↓ (file-select event)
LayoutManager
  ↓ (send OPEN)
Editor State Machine
  ↓ (transition to loading)
FileSystemService.read()
  ↓ (get file content)
Editor State Machine
  ↓ (transition to editing, update context)
EditorComponent
  ↓ (re-render with content)
User (edit content)
  ↓ (keydown/change event)
EditorComponent
  ↓ (send EDIT)
Editor State Machine
  ↓ (update context.content)
User (press execute)
  ↓ (click button)
LayoutManager
  ↓ (send EXECUTE)
Editor State Machine
  ↓ (transition to executing)
ExecutorService.execute()
  ↓ (run Node.js)
Editor State Machine
  ↓ (update context.logs)
OutputPanelComponent
  ↓ (addLog)
User (sees results)
```

## Module Structure

```
src/
├── core/
│   ├── machines/
│   │   ├── editor.ts        - State machine & actor creation
│   │   └── index.ts         - Exports
│   ├── services/
│   │   ├── logger.ts        - Logging service
│   │   ├── notification.ts  - Toast/notification system
│   │   ├── executor.ts      - Node.js execution
│   │   ├── filesystem.ts    - Virtual FS (IndexedDB)
│   │   ├── registry.ts      - Service container
│   │   └── index.ts         - Exports
│   └── types.ts             - Shared TypeScript types
├── ui/
│   ├── editor.ts            - Editor component
│   ├── file-tree.ts         - File tree component
│   ├── output-panel.ts      - Output display component
│   └── index.ts             - Exports
├── main.ts                  - App entry, layout, wiring
├── style.css                - Global styles (no CSS-in-JS)
└── index.html               - HTML shell
```

## Component Communication

### Event-Driven (UI → State)

```typescript
// FileTree dispatches custom event
element.dispatchEvent(new CustomEvent('file-select', {
  detail: { path: '/src/app.js' }
}))

// Main wires listener
element.addEventListener('file-select', (e) => {
  editorActor.send({ type: 'OPEN', path: e.detail.path })
})
```

### State Subscription (State → UI)

```typescript
// Component subscribes to state machine
editorActor.subscribe((snapshot) => {
  // Re-render when state changes
  component.render(snapshot)
})
```

### Service Notification (Service → UI)

```typescript
// Notification service broadcasts to listeners
notificationService.subscribe((toasts) => {
  toasts.forEach(toast => outputPanel.addLog(toast.type, toast.message))
})
```

## Styling

- **CSS-only**, no CSS-in-JS framework
- **Semantic color scheme** (Slate, Teal accents, dark theme)
- **Flexbox layout** for responsive multi-pane design
- **CSS custom properties** for theming (optional dark mode support)

## State Management Philosophy

**XState** manages editor state because:
- Explicit state transitions prevent invalid states
- Context is immutable, predictable updates
- Actor model suits decoupled component communication
- Visual state charts document behavior

**Services** handle side effects (I/O) because:
- Isolated from state machine (testable)
- Can be mocked or swapped implementations
- Lifecycle independent of component mounts

## Extending the Architecture

### Add a New Service

1. Create `src/core/services/myservice.ts`
2. Implement contract (interface)
3. Register in `initializeServices()` in `main.ts`
4. Inject via `registry.get('myservice')`

### Add a New Component

1. Create `src/ui/mycomponent.ts`
2. Constructor accepts container element
3. Implement `render()` method
4. Mount in `main.ts`
5. Wire event listeners if needed

### Add a New State Transition

1. Update `src/core/machines/editor.ts`
2. Add state to `states` object
3. Define `on` events
4. Update `context` if needed
5. Actors automatically pick up changes

## Testing

- **State machine**: XState provides `createTestingPlatform()`
- **Services**: Mock with implementing objects
- **Components**: Query DOM, dispatch events, verify output
- **Integration**: Test machine + services + components together

## Performance Considerations

- **Virtual scrolling**: For large file lists (future)
- **Debounced save**: Avoid hammering filesystem on every keystroke
- **Worker threads**: Execute Node.js in Web Worker to unblock UI
- **IndexedDB**: Store file content efficiently
- **Event delegation**: Use bubbling for list item clicks

## Future Enhancements

- Multi-tab editor
- Syntax highlighting (highlight.js integration)
- Themes (light/dark/custom CSS)
- Keyboard shortcuts (Command palette)
- File search (Ctrl+P)
- Integrated terminal
- Git integration
- Package manager (npm/yarn commands)
