# System Architecture

## Core Concepts

This application simulates a full IDE environment in the browser using a "Fat Client" model. 

- **Persistence Truth**: SQLite (via OPFS).
- **Session Truth**: `ideService` (in-memory state).
- **Runtime**: WebContainers (ephemeral execution environment).

## Layers

### 1. UI Layer (React)

- **Location**: `src/IDE/IDEStore.tsx` (Provider) and `src/IDE/IDEContext.ts` (Context).
- **Responsibilities**:
  - Holds view state (selected file id, loading/running flags).
  - Triggers service actions (`saveFile`, `run`).
  - Renders components based on service state.
- **Pattern**: Passive View. 

### 2. Service Layer (Orchestration & State)

- **Location**: `src/IDE/service/ideService.ts`.
- **Responsibilities**:
  - **Single Source of Truth**: Owns `_filesCache` and `WebContainer` instance.
  - **Optimistic Updates**: Updates local state immediately, then syncs to infrastructure.
  - **Infrastructure Agnostic**: Orchestrates DB and Runtime without leaking details to UI.

### 3. Persistence Layer (SQLite)

- **Location**: `src/IDE/db.ts`.
- **Tech**: `@sqlite.org/sqlite-wasm` with `sqlite3Worker1Promiser`.
- **Why**: SQLite WASM handles its own worker offloading internally, so we use it directly as an async module.
- **Storage**: OPFS (Origin Private File System) for persistence.

### 4. Runtime Layer (WebContainers)

- **Role**: Executes Node.js code in-browser.
- **Managed By**: `ideService.ts` (private instance).
- **Sync Strategy**:
  - Boot: Mount file tree snapshot.
  - Edit: Incremental `fs.writeFile`.
  - Run: Spawn process.

## Data Flow Example (Create File)

```
User clicks "New File"
    |
    v
IDEStore.createFile("index.js")
    |
    v
Service.createNode("index.js")
    |
    v
1. Calls db.createFile() (Async, uses internal SQLite worker)
2. Updates local _filesCache (Optimistic)
3. Writes to WebContainer.fs (Runtime Sync)
    |
    v
Service returns updated FileTree immediately
    |
    v
IDEStore.setFiles(newTree) -> UI Re-renders
```

## Simplification Note

We intentionally removed the custom `src/IDE/worker` layer. Since `sqlite3Worker1Promiser` already runs in a worker, adding our own worker wrapper was redundant complexity (YAGNI).
