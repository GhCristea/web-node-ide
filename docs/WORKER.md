# Worker Architecture

## Overview

The database layer runs in a dedicated Web Worker to keep file operations off the main thread. This prevents UI blocking during save/load operations, especially with large file trees or slower OPFS access.

## Components

### 1. Worker Protocol (`src/IDE/worker/types.ts`)

Strict TypeScript types defining the contract between main thread and worker:
- `WorkerRequest`: Union of all possible requests (INIT_DB, GET_FILES, SAVE_FILE, etc.)
- `WorkerResponse`: Union of all possible responses (success variants + ERROR)
- Every request has a unique `reqId` for async correlation

### 2. DB Worker (`src/IDE/worker/db.worker.ts`)

Runs in worker context:
- Imports `db.ts` (SQLite WASM operations)
- Listens for `WorkerRequest` messages
- Executes DB operations
- Posts `WorkerResponse` back to main thread

### 3. Worker Client (`src/IDE/worker/dbClient.ts`)

Runs in main thread:
- Provides promise-based API matching `db.ts` signatures
- Handles request/response correlation via `reqId` tracking
- Manages pending requests map
- Abstracts `postMessage` details from consumers

### 4. Integration (`src/IDE/IDEStore.tsx`)

- Creates worker instance: `new Worker(new URL('./worker/db.worker.ts', import.meta.url), { type: 'module' })`
- Wraps in client: `new DBWorkerClient(worker)`
- Passes to service as `db` dependency
- Service layer remains unchanged (duck typing)

## Data Flow

```
UI (IDEStore)
    |
    v
Service (ideService)
    |
    v
DBWorkerClient (main thread)
    | postMessage(WorkerRequest)
    v
DB Worker (worker context)
    |
    v
SQLite WASM (OPFS)
    |
    v (result)
DB Worker
    | postMessage(WorkerResponse)
    v
DBWorkerClient
    |
    v
Service
    |
    v
UI updates
```

## Benefits

1. **Non-blocking UI**: File saves/loads don't freeze the editor
2. **Type safety**: Protocol enforces correct message shapes
3. **Drop-in replacement**: Service layer unchanged (same interface)
4. **Future-proof**: Easy to add more worker operations (e.g., file search, linting)

## Limitations

- WebContainer remains on main thread (streams easier to handle)
- Worker overhead for tiny operations (~1-2ms per message)
- Debugging requires worker dev tools
