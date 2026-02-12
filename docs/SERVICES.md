# Services Architecture

## Overview

Services handle all side effects and external I/O. They're singletons registered in a dependency injection container and injected into components.

**Core principle:** Services are independent of UI and state machine. They can be mocked, swapped, or tested in isolation.

## Service Registry

### Initialization

```typescript
import { initializeServices, registry } from './core/services'

// Call once at app startup
await initializeServices()

// Access any service
const logger = registry.get('logger')
const filesystem = registry.get('filesystem')
const executor = registry.get('executor')
const notification = registry.get('notification')
```

### Extending Registry

Add a new service:

```typescript
// 1. Create service
export class MyService {
  doSomething() { /* ... */ }
}

// 2. Register in initializeServices()
import { MyService } from './my-service'

export async function initializeServices(): Promise<void> {
  const myService = new MyService()
  registry.register('myservice', myService)
}

// 3. Use it
const myService = registry.get('myservice')
```

## FileSystemService

**Purpose:** Virtual file system backed by IndexedDB.

**Key methods:**
- `readFile(path, encoding?)` - Read file contents
- `writeFile(path, content, options?)` - Write file
- `readdir(path, options?)` - List directory
- `mkdir(path, options?)` - Create directory
- `rm(path, options?)` - Delete file/directory
- `mount(tree, mountPoint?)` - Mount WebContainers tree

**Usage in components:**

```typescript
const fs = registry.get('filesystem')

// Read file when opening in editor
const content = await fs.readFile('/src/main.js', 'utf-8')

// Save file
await fs.writeFile('/src/main.js', newContent, { encoding: 'utf-8' })

// List files for tree view
const entries = await fs.readdir('/src', { withFileTypes: true })
```

**See:** [FILESYSTEM.md](./FILESYSTEM.md) for complete API.

## ExecutorService

**Purpose:** Execute JavaScript code in Web Worker, capture output.

**Key methods:**
- `execute(code, options?)` - Run code, return stdout/stderr/exitCode
- `terminate()` - Stop worker

**Options:**
- `timeout` - Max execution time (default: 5000ms)
- `env` - Environment variables passed to code

**Usage:**

```typescript
const executor = registry.get('executor')

try {
  const result = await executor.execute('console.log("hello")', { timeout: 3000 })
  console.log(result)
  // {
  //   stdout: 'hello\n',
  //   stderr: '',
  //   exitCode: 0
  // }
} catch (error) {
  console.error('Execution failed:', error.message)
}
```

**Worker isolation:**
- Code runs in separate thread (non-blocking UI)
- Console output captured and returned
- Errors caught and reported
- Timeout prevents infinite loops

## LoggerService

**Purpose:** Structured logging with subscriber pattern.

**Key methods:**
- `log(message)` - Info level
- `error(message)` - Error level
- `debug(message)` - Debug level
- `getLogs()` - Get all logs
- `clear()` - Clear logs
- `subscribe(callback)` - Listen to changes

**Subscriber pattern:**

```typescript
const logger = registry.get('logger')

const unsubscribe = logger.subscribe((logs) => {
  console.log('Current logs:', logs)
})

logger.log('Something happened')
// Logs updated, callback fires automatically

unsubscribe() // Stop listening
```

**Log storage:**
- Max 1000 logs (oldest removed)
- Timestamps automatically added
- Types: 'log', 'error', 'debug'

## NotificationService

**Purpose:** Toast notifications with auto-dismiss.

**Key methods:**
- `info(message, duration?)` - Show info toast
- `error(message, duration?)` - Show error toast
- `success(message, duration?)` - Show success toast
- `show(message, type, duration?)` - Generic show
- `dismiss(id)` - Dismiss by ID
- `dismissAll()` - Clear all toasts
- `getToasts()` - Get active toasts
- `subscribe(callback)` - Listen to changes

**Usage:**

```typescript
const notification = registry.get('notification')

// Simple notifications
notification.info('Saving...')
notification.success('Saved!', 2000)
notification.error('Failed to save', 5000)

// Manual dismiss
const id = notification.show('Click to dismiss', 'info', 0)
setTimeout(() => notification.dismiss(id), 3000)

// Subscribe to changes
notification.subscribe((toasts) => {
  toasts.forEach(toast => {
    console.log(`${toast.type}: ${toast.message}`)
  })
})
```

**Auto-dismiss:**
- Durations in milliseconds
- Default: 3000ms (info/success), 5000ms (error)
- Pass 0 for no auto-dismiss

## Service Integration Patterns

### Pattern 1: Services in Components

```typescript
import { registry } from '../core/services'
import type { FileSystemService, ExecutorService } from '../core/services'

export class MyComponent {
  private filesystem: FileSystemService
  private executor: ExecutorService

  constructor(container: HTMLElement) {
    this.filesystem = registry.get('filesystem')
    this.executor = registry.get('executor')
  }

  private async loadAndRun(): Promise<void> {
    const code = await this.filesystem.readFile('/script.js', 'utf-8')
    const result = await this.executor.execute(code)
    console.log(result)
  }
}
```

### Pattern 2: Services in State Machine

Services can be used in XState actions and guards:

```typescript
import { setup } from 'xstate'
import { registry } from '../core/services'

export const myMachine = setup({
  actions: {
    logEvent: () => {
      const logger = registry.get('logger')
      logger.log('Event fired')
    }
  },
  guards: {
    canExecute: () => {
      const fs = registry.get('filesystem')
      // ... check some state
      return true
    }
  }
}).createMachine({
  // ... machine definition
})
```

### Pattern 3: Service-to-Service Composition

```typescript
// ExecutorService uses LoggerService
export class ExecutorService {
  private logger: LoggerService

  constructor(logger: LoggerService) {
    this.logger = logger
  }

  async execute(code: string): Promise<ExecutionResult> {
    this.logger.log('Executing code...')
    // ...
  }
}

// Initialize with dependency
await initializeServices()
```

## Error Handling

### Service Errors

```typescript
try {
  const content = await fs.readFile('/nonexistent.js')
} catch (error) {
  if (error instanceof Error) {
    logger.error(`Failed to read file: ${error.message}`)
    notification.error('File not found')
  }
}
```

### Worker Timeout

```typescript
try {
  await executor.execute(infiniteLoop, { timeout: 1000 })
} catch (error) {
  // "Execution timeout (1000ms)"
  logger.error(error.message)
}
```

## Testing Services

### Mock FileSystemService

```typescript
class MockFileSystem implements FileSystemService {
  async readFile(path: string): Promise<string> {
    return 'console.log("test")'
  }
  // ... other methods
}

// In test setup
registry.register('filesystem', new MockFileSystem())
```

### Mock ExecutorService

```typescript
class MockExecutor implements ExecutorService {
  async execute(code: string): Promise<ExecutionResult> {
    return {
      stdout: 'mocked output\n',
      stderr: '',
      exitCode: 0
    }
  }
}
```

## Performance Considerations

### FileSystemService
- IndexedDB operations are async (use await)
- Large files slow to read/write (>50MB problematic)
- First mount slower due to DB initialization

### ExecutorService
- Web Worker initialization ~5-10ms first time
- Code execution runs in separate thread (UI non-blocking)
- Timeout prevents infinite loops
- Consider debouncing rapid executions

### LoggerService
- In-memory array, max 1000 entries
- Subscriptions fired on every log (consider throttling)

### NotificationService
- Lightweight, fast dismissals
- Multiple toasts stack in UI

## Migration & Swapping

### Swap FileSystemService for WebContainers

```typescript
// Create adapter
export class WebContainersFileSystem extends FileSystemService {
  async readFile(path: string) {
    // Use WebContainers API instead of IndexedDB
  }
}

// In initializeServices
const fs = new WebContainersFileSystem()
await fs.initialize()
registry.register('filesystem', fs)
```

### Swap ExecutorService for Real Node.js

```typescript
// Create server-side executor
export class ServerExecutor implements ExecutorService {
  async execute(code: string) {
    const response = await fetch('/api/execute', {
      method: 'POST',
      body: JSON.stringify({ code })
    })
    return response.json()
  }
}
```

## Best Practices

1. **Always await async services** - Don't fire and forget
2. **Use service subscriptions** - Don't poll in components
3. **Isolate service logic** - Don't put UI in services
4. **Handle errors** - Wrap in try/catch
5. **Log important operations** - Help with debugging
6. **Notify users** - Show toasts for long operations
7. **Clean up subscriptions** - Prevent memory leaks
8. **Test services independently** - Mock other dependencies
