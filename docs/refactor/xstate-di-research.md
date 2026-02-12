# Phase 3.4: XState Dependency Injection

**Date:** February 2026  
**Branch:** `refactor/core-architecture`  
**Objective:** Research and document XState service registry patterns for DI (dependency injection).  
**Status:** ✅ Complete

---

## Overview

In XState v5+, services (side effects, external integrations) are injected via `actor` implementations. This document explores:

1. **Current XState v5 patterns** – How services are injected
2. **Service registry approaches** – Centralizing service resolution
3. **DI container patterns** – TypeScript-safe service factory
4. **Testing strategies** – Mock service injection

**Key insight:** XState doesn't mandate a service registry. We choose what fits our architecture.

---

## Current XState v5 Integration in web-node-ide

### Where XState is Used

```bash
grep -r "createActor\|useMachine" src/
# Likely: IDE state machine for editor, file tree, execution
```

### Likely Services

| Service | Purpose | Current Injection |
|---------|---------|-------------------|
| FileSystem | Read/write files, list directories | Inline callbacks |
| Executor | Run/debug code | Inline callbacks |
| Notifications | User feedback (toast, alerts) | Global or prop-based |
| Logger | Execution logs, debug output | Console.log |
| StorageService | localStorage persistence | Direct access |

---

## XState v5 Service Injection Basics

### The Action Pattern (Pre-v5)

**Old (XState v4):**
```typescript
create Machine({
  initial: 'idle',
  states: {
    idle: {
      on: { RUN: 'running' }
    },
    running: {
      invoke: {
        src: (ctx, event) => someAsyncFunction(event.code)
      }
    }
  }
});
```

### The Actor Pattern (XState v5+)

**New (XState v5):**
```typescript
import { createMachine, createActor, fromPromise } from 'xstate';

// Define machine
const codeMachine = createMachine({
  initial: 'idle',
  types: {
    actors: { executeCode: 'execute-code-actor' }
  },
  states: {
    idle: { on: { RUN: 'running' } },
    running: {
      invoke: {
        src: 'executeCode',  // Reference to actor implementation
        onDone: { target: 'idle', actions: 'logResult' }
      }
    }
  }
});

// Create actor (where services are injected)
const actor = createActor(codeMachine, {
  input: { code: 'console.log("hello")' },
  // Inject services here
  systemId: 'code-executor',
  guards: { /* guard implementations */ },
  actions: { /* action implementations */ },
  delays: { /* delay overrides */ },
  actors: {
    // Service implementations
    'execute-code-actor': fromPromise(({ input }) =>
      executeCode(input.code)
    )
  }
}).start();
```

### Key Differences

| Aspect | v4 (inline) | v5 (actor) |
|--------|------------|----------|
| **Service Location** | Defined in machine | Injected at runtime |
| **Testability** | Hard (services embedded) | Easy (inject mocks) |
| **Code Reuse** | Difficult | Straightforward |
| **Type Safety** | Weak | Strong (types: actors) |
| **Organization** | Monolithic | Modular |

---

## Pattern 1: Direct Injection (Simplest)

### Minimal Approach

```typescript
import { createMachine, createActor, fromPromise } from 'xstate';

// Machine definition (no services, just shape)
const appMachine = createMachine({
  initial: 'idle',
  types: {
    actors: {
      saveFile: 'save-file-actor',
      loadFile: 'load-file-actor'
    }
  },
  states: {
    idle: {
      on: { SAVE: 'saving' }
    },
    saving: {
      invoke: {
        src: 'saveFile'
      }
    }
  }
});

// Create actor with injected services
const actor = createActor(appMachine, {
  actors: {
    'save-file-actor': fromPromise(async ({ input }) => {
      const { fileService } = input;
      return fileService.save(input.path, input.content);
    })
  }
}).start();
```

### Pros
- ✅ Simple, minimal boilerplate
- ✅ No external dependencies
- ✅ Easy to understand

### Cons
- ❌ Repeats actor definitions everywhere
- ❌ No centralized service registry
- ❌ Hard to swap services globally

---

## Pattern 2: Service Registry (Recommended)

### Architecture

```
Service Registry (singleton)
    |
    ├─ FileService
    ├─ ExecutionService
    ├─ NotificationService
    └─ LoggerService
        |
        v
Actor Factory
    |
    ├─ createFileActor()
    ├─ createExecutorActor()
    └─ createAppActor()
        |
        v
React Component (useMachine)
```

### Implementation

#### 1. Define Service Interfaces

```typescript
// src/core/services/types.ts

export interface FileService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<string[]>;
  deleteFile(path: string): Promise<void>;
}

export interface ExecutionService {
  executeCode(code: string): Promise<{ stdout: string; stderr: string }>;
  stopExecution(): Promise<void>;
}

export interface NotificationService {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

export interface LoggerService {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
```

#### 2. Create Registry Container

```typescript
// src/core/services/registry.ts

import type {
  FileService,
  ExecutionService,
  NotificationService,
  LoggerService
} from './types';

export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private services = new Map<string, unknown>();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service "${key}" not registered`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.services);
  }
}

// Export singleton instance
export const registry = ServiceRegistry.getInstance();
```

#### 3. Implement Concrete Services

```typescript
// src/core/services/file-service.ts

import type { FileService } from './types';

export class FileServiceImpl implements FileService {
  async readFile(path: string): Promise<string> {
    // Implementation: fetch from server or use File API
    const response = await fetch(`/api/files/${path}`);
    return response.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fetch(`/api/files/${path}`, {
      method: 'PUT',
      body: content
    });
  }

  async listDirectory(path: string): Promise<string[]> {
    const response = await fetch(`/api/directories/${path}`);
    const data = await response.json();
    return data.files;
  }

  async deleteFile(path: string): Promise<void> {
    await fetch(`/api/files/${path}`, {
      method: 'DELETE'
    });
  }
}

// src/core/services/execution-service.ts

import type { ExecutionService } from './types';

export class ExecutionServiceImpl implements ExecutionService {
  private worker?: Worker;

  async executeCode(code: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.worker) {
      this.worker = new Worker('/executor-worker.js');
    }

    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (event) => {
        resolve(event.data);
      };
      this.worker!.onerror = (error) => {
        reject(error);
      };
      this.worker!.postMessage({ code });
    });
  }

  async stopExecution(): Promise<void> {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
```

#### 4. Initialize Registry at App Startup

```typescript
// src/main.tsx

import { registry } from './core/services/registry';
import { FileServiceImpl } from './core/services/file-service';
import { ExecutionServiceImpl } from './core/services/execution-service';
import { NotificationServiceImpl } from './core/services/notification-service';
import { LoggerServiceImpl } from './core/services/logger-service';

function initializeServices(): void {
  registry.register('file', new FileServiceImpl());
  registry.register('execution', new ExecutionServiceImpl());
  registry.register('notification', new NotificationServiceImpl());
  registry.register('logger', new LoggerServiceImpl());
}

initializeServices();

creatRoot(document.getElementById('root')!).render(<App />);
```

#### 5. Create Actor Factory

```typescript
// src/core/machines/actors.ts

import { fromPromise, createActor } from 'xstate';
import { registry } from '../services/registry';
import type { FileService, ExecutionService } from '../services/types';

// Actor implementations
export const fileActors = {
  'save-file': fromPromise(async ({ input }: { input: { path: string; content: string } }) => {
    const fileService = registry.get<FileService>('file');
    await fileService.writeFile(input.path, input.content);
    return { success: true };
  }),

  'load-file': fromPromise(async ({ input }: { input: { path: string } }) => {
    const fileService = registry.get<FileService>('file');
    const content = await fileService.readFile(input.path);
    return { content };
  })
};

export const executionActors = {
  'execute-code': fromPromise(async ({ input }: { input: { code: string } }) => {
    const executionService = registry.get<ExecutionService>('execution');
    const result = await executionService.executeCode(input.code);
    return result;
  })
};

// Helper to create actors with registry services
export function createAppActor(machine: typeof appMachine) {
  return createActor(machine, {
    actors: {
      ...fileActors,
      ...executionActors
    }
  }).start();
}
```

#### 6. Use in Machine Definition

```typescript
// src/core/machines/app-machine.ts

import { createMachine } from 'xstate';

export const appMachine = createMachine({
  id: 'app',
  initial: 'idle',
  types: {
    actors: {
      'save-file': 'save-file-actor',
      'load-file': 'load-file-actor',
      'execute-code': 'execute-code-actor'
    }
  },
  states: {
    idle: {
      on: {
        SAVE: { target: 'saving' },
        LOAD: { target: 'loading' }
      }
    },
    saving: {
      invoke: {
        src: 'save-file'
      }
    },
    loading: {
      invoke: {
        src: 'load-file'
      }
    }
  }
});
```

#### 7. Use in React Component

```typescript
// src/IDE/index.tsx

import { useMachine } from '@xstate/react';
import { createAppActor } from '../core/machines/actors';
import { appMachine } from '../core/machines/app-machine';

function IDE() {
  const [state, send] = useMachine(() => createAppActor(appMachine));

  return (
    <div>
      <button onClick={() => send({ type: 'SAVE', path: 'main.js', content: 'console.log(1)' })}>
        Save
      </button>
      {state.matches('saving') && <p>Saving...</p>}
    </div>
  );
}
```

### Pros
- ✅ Centralized service management
- ✅ Easy to swap implementations globally
- ✅ TypeScript-safe service resolution
- ✅ Scales well with many services
- ✅ Perfect for testing (see Testing section)

### Cons
- ❌ Slight boilerplate (registry setup)
- ❌ Singleton pattern (can cause issues in some SSR scenarios)
- ❌ Requires discipline (services must be registered)

---

## Pattern 3: Context-Based DI (Alternative)

For smaller apps, React Context can replace a registry:

```typescript
// src/core/services/service-context.tsx

import { createContext, useContext, ReactNode } from 'react';
import type { FileService, ExecutionService } from './types';

export interface ServiceContextValue {
  fileService: FileService;
  executionService: ExecutionService;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

export function useServices(): ServiceContextValue {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be inside ServiceProvider');
  }
  return context;
}

export function ServiceProvider({
  children,
  value
}: {
  children: ReactNode;
  value: ServiceContextValue;
}) {
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}
```

**Usage:**
```typescript
function App() {
  const services = {
    fileService: new FileServiceImpl(),
    executionService: new ExecutionServiceImpl()
  };

  return (
    <ServiceProvider value={services}>
      <IDE />
    </ServiceProvider>
  );
}

function IDEComponent() {
  const { fileService } = useServices();
  // Use fileService
}
```

**Pros:**
- ✅ React-native approach
- ✅ Easy multi-tenant testing (different contexts)
- ✅ No globals

**Cons:**
- ❌ Requires React context for non-React code
- ❌ More boilerplate (Provider wrapping)
- ❌ Less efficient (re-renders on context changes)

---

## Testing Strategies

### Strategy 1: Mock Services at Registry Level

```typescript
// src/tests/setup.ts

import { registry } from '../core/services/registry';
import type { FileService } from '../core/services/types';

// Create mock implementation
class MockFileService implements FileService {
  private files = new Map<string, string>();

  async readFile(path: string): Promise<string> {
    return this.files.get(path) ?? '';
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async listDirectory(path: string): Promise<string[]> {
    return Array.from(this.files.keys()).filter((key) => key.startsWith(path));
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }
}

// Before each test
beforeEach(() => {
  registry.register('file', new MockFileService());
});
```

### Strategy 2: Mock in createActor Options

```typescript
// src/tests/app-machine.test.ts

import { createActor } from 'xstate';
import { appMachine } from '../core/machines/app-machine';
import type { FileService } from '../core/services/types';

it('saves file successfully', async () => {
  const mockFileService: FileService = {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    listDirectory: jest.fn(),
    deleteFile: jest.fn()
  };

  // Override actor implementation
  const actor = createActor(appMachine, {
    actors: {
      'save-file': fromPromise(async ({ input }) => {
        await mockFileService.writeFile(input.path, input.content);
        return { success: true };
      })
    }
  }).start();

  // Send event and verify
  actor.send({ type: 'SAVE', path: 'test.js', content: 'console.log(1)' });
  await waitFor(() => {
    expect(actor.getSnapshot().matches('idle')).toBe(true);
  });
  expect(mockFileService.writeFile).toHaveBeenCalledWith('test.js', 'console.log(1)');
});
```

### Strategy 3: Full Machine Snapshot Testing

```typescript
// src/tests/app-machine.snapshot.test.ts

it('matches snapshot', async () => {
  const actor = createAppActor(appMachine);
  const snapshot = actor.getSnapshot();
  expect(snapshot).toMatchSnapshot();
});
```

---

## Real-World Example: File Editor Machine

```typescript
// src/core/machines/editor-machine.ts

import { createMachine } from 'xstate';

export const editorMachine = createMachine({
  id: 'editor',
  initial: 'idle',
  types: {
    context: {} as {
      path: string;
      content: string;
      lastSaved: Date | null;
      error: string | null;
    },
    actors: {
      'load-file': 'load-file-actor',
      'save-file': 'save-file-actor'
    }
  },
  context: {
    path: '',
    content: '',
    lastSaved: null,
    error: null
  },
  states: {
    idle: {
      on: {
        OPEN: { target: 'loading' },
        MODIFY: { actions: 'updateContent' }
      }
    },
    loading: {
      invoke: {
        src: 'load-file',
        onDone: {
          target: 'idle',
          actions: 'setContent'
        },
        onError: {
          target: 'error',
          actions: 'setError'
        }
      }
    },
    error: {
      on: { RETRY: 'loading' }
    },
    saved: {
      type: 'final'
    }
  },
  on: {
    SAVE: { target: 'saving' },
    'SAVE.done': { target: 'idle', actions: 'markSaved' }
  }
});

export const editorActors = {
  'load-file': fromPromise(async ({ input }: { input: { path: string } }) => {
    const fs = registry.get<FileService>('file');
    const content = await fs.readFile(input.path);
    return { path: input.path, content };
  }),
  'save-file': fromPromise(async ({ input }: { input: { path: string; content: string } }) => {
    const fs = registry.get<FileService>('file');
    await fs.writeFile(input.path, input.content);
    return { path: input.path, savedAt: new Date() };
  })
};
```

---

## Migration Path: Current → Registry Pattern

### Phase 1: Identify Current Services

```bash
# Find invoke blocks and external side effects
grep -r "invoke\|async\|fetch" src/core/machines/
# List all services used
```

### Phase 2: Create Service Interfaces

```typescript
// src/core/services/types.ts
// Define all service interfaces
```

### Phase 3: Implement Services

```typescript
// src/core/services/file-service.ts
// src/core/services/execution-service.ts
// etc.
```

### Phase 4: Set Up Registry

```typescript
// src/core/services/registry.ts
// src/main.tsx - register services
```

### Phase 5: Refactor Machines

```typescript
// Remove inline invoke implementations
// Reference actor names instead
```

### Phase 6: Create Actor Factory

```typescript
// src/core/machines/actors.ts
// Central place for all actor definitions
```

### Phase 7: Update React Components

```typescript
// Use createAppActor factory instead of direct machine
```

---

## TypeScript Patterns

### Strict Service Registry

```typescript
// Type-safe registry
class TypedRegistry<T extends Record<string, unknown>> {
  private services: Partial<T> = {};

  register<K extends keyof T>(key: K, service: T[K]): void {
    this.services[key] = service;
  }

  get<K extends keyof T>(key: K): T[K] {
    if (!(key in this.services)) {
      throw new Error(`Service ${String(key)} not registered`);
    }
    return this.services[key]!;
  }
}

type Services = {
  file: FileService;
  execution: ExecutionService;
  notification: NotificationService;
};

const registry = new TypedRegistry<Services>();
registry.register('file', new FileServiceImpl()); // ✅ Type-safe
// registry.register('unknown', ...); // ❌ Compile error
```

### Actor Type Inference

```typescript
type ActorMap = typeof editorActors; // ✅ Inferred from object

const actor = createActor(editorMachine, {
  actors: editorActors // ✅ Auto-typed
});
```

---

## Common Pitfalls

### ⚠️ Circular Dependencies

```typescript
// ❌ Bad: FileService depends on NotificationService
class FileServiceImpl implements FileService {
  constructor(private notify: NotificationService) {}
}

// ✅ Good: Services are independent, orchestration via machine
class FileServiceImpl implements FileService {
  // No dependencies on other services
}
```

### ⚠️ Global State in Services

```typescript
// ❌ Bad: Mutable state across requests
class ExecutionServiceImpl implements ExecutionService {
  private currentCode = ''; // Shared state!
}

// ✅ Good: Stateless or input-driven state
class ExecutionServiceImpl implements ExecutionService {
  async executeCode(code: string) {
    // State passed as input
  }
}
```

### ⚠️ Accessing Registry in Service Constructor

```typescript
// ❌ Bad: Service gets another service from registry
class FileServiceImpl {
  private logger = registry.get<LoggerService>('logger');
}

// ✅ Good: Inject dependencies or accept them lazily
class FileServiceImpl implements FileService {
  async readFile(path: string): Promise<string> {
    const logger = registry.get<LoggerService>('logger');
    logger.log(`Reading ${path}`);
    // ...
  }
}
```

---

## Comparison: DI Patterns

| Pattern | Complexity | Testability | Scalability | Recommendation |
|---------|-----------|-------------|-------------|----------------|
| **Direct Injection** | Low | Medium | Poor | Small apps only |
| **Service Registry** | Medium | Excellent | Excellent | ✅ Production |
| **React Context** | Low | Good | Medium | React-only apps |
| **Dependency Container** | High | Excellent | Excellent | Large systems |

---

## Acceptance Criteria: Phase 3.4 Complete ✅

- [x] Explained XState v5 actor pattern vs v4 invoke
- [x] Provided direct injection example (minimal DI)
- [x] Documented service registry pattern (recommended)
- [x] Complete implementation with 7 steps
- [x] Created type-safe service interfaces
- [x] Built service registry container class
- [x] Implemented concrete services (file, execution)
- [x] Set up initialization at app startup
- [x] Created actor factory with service resolution
- [x] Updated machine definitions to use actors
- [x] Showed React component integration
- [x] Provided React Context alternative
- [x] Documented three testing strategies
- [x] Real-world editor machine example
- [x] Included migration path (7 phases)
- [x] Covered TypeScript patterns and type safety
- [x] Listed common pitfalls and solutions
- [x] Comparison matrix of DI approaches

---

## Next Steps

**Phase 3.5:** Error handling research (Result types, error boundaries)  
**Phase 4:** Synthesize into core-ui-architecture.md  
**Phase 5:** Begin implementation (services, actors, machines)

---

## References

- **XState Docs:** https://stately.ai/docs/
- **XState Actors:** https://stately.ai/docs/actor-model
- **XState Testing:** https://stately.ai/docs/testing
- **Dependency Injection:** https://en.wikipedia.org/wiki/Dependency_injection
- **Service Locator Pattern:** https://refactoring.guru/design-patterns/service-locator

---

**Document Status:** ✅ Ready for Phase 3.5  
**Last Updated:** February 2026
