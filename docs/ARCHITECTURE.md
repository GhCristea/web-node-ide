# System Architecture

## Core Concepts

This application simulates a full IDE environment in the browser and does **not** have a traditional backend.

## Layers

### 1. UI Layer (React)

- **Location**: `src/IDE/IDEStore.tsx` (Provider) and `src/IDE/IDEContext.ts` (Context).
- **Responsibilities**:
  - Holds view state (selected file id, loading/running flags, errors).
  - Triggers service actions and refreshes the file tree when needed.
  - Renders editor/terminal/file tree via components.

### 2. Service Layer (Orchestration)

- **Location**: `src/IDE/service/ideService.ts`.
- **Responsibilities**:
  - Orchestrates file operations, persistence, runtime sync, and process execution.
  - Keeps a lightweight in-memory cache of file records for path resolution.
  - Encapsulates "where does a new file go?" logic (parent resolution).
  - Agnostic to whether DB is in-thread or worker (duck typing via dependency injection).

### 3. Worker Layer (DB Operations)

- **Location**: `src/IDE/worker/`.
- **Components**:
  - `db.worker.ts`: Runs in worker context, imports `db.ts`, handles messages.
  - `dbClient.ts`: Main thread proxy with promise-based API matching `db.ts`.
  - `types.ts`: Protocol definitions for `WorkerRequest` / `WorkerResponse`.
- **Why**: Keeps SQLite WASM operations off the main thread for non-blocking UI.
- **Details**: See [WORKER.md](./WORKER.md) for implementation specifics.

### 4. Persistence Layer (File system source of truth)

- **Storage**: SQLite via OPFS (Origin Private File System) when available.
- **Access**: `src/IDE/db.ts` (now runs inside worker).
- **Notes**:
  - File listing fetches metadata; file content is fetched on demand.
  - Reset is implemented as DB truncate.

### 5. Runtime Layer (WebContainers)

- **Role**: Executes Node.js code in-browser.
- **Integration**: Managed via `src/IDE/useWebContainer.ts` hook.
- **Runs On**: Main thread (easier stream handling with xterm).
- **Syncing**:
  - Mount: service mounts a snapshot of file paths into the container when ready.
  - Save: service writes to DB (via worker) and also writes to `WebContainer.fs`.
  - Run: service spawns `node <path>` and pipes output to the terminal.

### 6. Terminal

- **Tech**: xterm.js + xterm-addon-fit.
- **Component**: `src/IDE/TerminalComponent.tsx`.
- **Connection**: UI passes a small terminal adapter (currently `terminalRef.write`) to the service.

## Data Flow Example (Save File)

```
User types in Monaco
    |
    v
IDEStore.saveFile() called
    |
    v
Service.saveFile(id, content, ...)
    |
    v
DBWorkerClient.saveFileContent(id, content)
    | postMessage({ type: 'SAVE_FILE', ... })
    v
DB Worker receives message
    |
    v
db.saveFileContent(id, content) [SQLite WASM]
    |
    v
Worker responds: { type: 'SAVE_FILE_SUCCESS' }
    |
    v
DBWorkerClient resolves promise
    |
    v
Service also syncs to WebContainer.fs (if ready)
    |
    v
Terminal writes "Synced <path>"
```

## Intentionally Not Supported

- URL-driven file selection / deep-linking.
- Server-side execution.
