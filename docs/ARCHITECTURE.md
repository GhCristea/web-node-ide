# System Architecture

## Core Concepts

This application simulates a full IDE environment in the browser and does **not** have a traditional backend.

## Layers

### 1. UI Layer (React)

- **Location**: `src/IDE/IDEStore.tsx` (Provider) and `src/IDE/IDEContext.ts` (Context).
- **Responsibilities**:
  - Holds view state (selected file id, loading/running flags, errors).
  - Triggers service actions and receives updated state (e.g., file tree).
  - Renders editor/terminal/file tree via components.
- **Pattern**: Passive View. Does not manage business logic or infrastructure lifecycle.

### 2. Service Layer (Orchestration & State)

- **Location**: `src/IDE/service/ideService.ts`.
- **Responsibilities**:
  - **Single Source of Truth**: Maintains the file tree state (`_filesCache`) and WebContainer instance.
  - **Optimistic Updates**: Updates local state immediately, then syncs to worker/runtime.
  - **Lifecycle Owner**: Manages WebContainer boot and shutdown.
  - **Infrastructure Agnostic**: Orchestrates DB and Runtime without leaking details to UI.

### 3. Worker Layer (DB Operations)

- **Location**: `src/IDE/worker/`.
- **Components**:
  - `db.worker.ts`: Runs in worker context, imports `db.impl.ts`, handles messages.
  - `dbClient.ts`: Main thread proxy with promise-based API matching `db.impl.ts`.
  - `types.ts`: Protocol definitions for `WorkerRequest` / `WorkerResponse`.
- **Why**: Keeps SQLite WASM operations off the main thread for non-blocking UI.

### 4. Persistence Layer (File system source of truth)

- **Storage**: SQLite via OPFS (Origin Private File System) when available.
- **Access**: `src/IDE/worker/db.impl.ts` (worker-only).

### 5. Runtime Layer (WebContainers)

- **Role**: Executes Node.js code in-browser.
- **Managed By**: `ideService.ts` (internal private state).
- **Syncing**:
  - Mount: Service mounts files on boot or load.
  - Save: Service writes to `WebContainer.fs` immediately after DB save.
  - Run: Service spawns process and pipes output.

### 6. Terminal

- **Tech**: xterm.js + xterm-addon-fit.
- **Component**: `src/IDE/TerminalComponent.tsx`.
- **Connection**: UI passes a small terminal adapter to the service via dependencies.

## Data Flow Example (Create File)

```
User clicks "New File"
    |
    v
IDEStore.createFile("index.js")
    |
    v
Service.createNode("index.js", ...)
    |
    v
1. Calls DBWorkerClient (Async, Persistence)
2. Updates local _filesCache (Optimistic)
3. Writes to WebContainer.fs (Runtime Sync)
    |
    v
Service returns updated FileTree immediately
    |
    v
IDEStore.setFiles(newTree) -> UI Re-renders
```

## Intentionally Not Supported

- URL-driven file selection / deep-linking.
- Server-side execution.
