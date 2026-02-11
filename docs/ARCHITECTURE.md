# System Architecture

## Core Concepts

This application simulates a full IDE environment in the browser and does **not** have a traditional backend.

## Layers

### 1. UI Layer (React)

- **Location**: `src/IDE/IDEStore.tsx` (Provider) and `src/IDE/IDEContext.ts` (Context).
- **Responsibilities**:
  - Holds view state (selected file id, loading/running flags, errors).
  - Triggers service actions and refreshes the file tree when needed.
  - Renders editor/terminal/file tree via components (not described here).

### 2. Service Layer (Orchestration)

- **Location**: `src/IDE/service/ideService.ts`.
- **Responsibilities**:
  - Orchestrates file operations, persistence, runtime sync, and process execution.
  - Keeps a lightweight in-memory cache of file records for path resolution.
  - Encapsulates “where does a new file go?” logic (parent resolution).

### 3. Persistence Layer (File system source of truth)

- **Storage**: SQLite via OPFS (Origin Private File System) when available.
- **Access**: All file CRUD operations go through `src/IDE/db.ts`.
- **Notes**:
  - File listing fetches metadata; file content is fetched on demand.
  - Reset is implemented as DB truncate.

### 4. Runtime Layer (WebContainers)

- **Role**: Executes Node.js code in-browser.
- **Integration**: Managed via `src/IDE/useWebContainer.ts` hook.
- **Syncing**:
  - Mount: service mounts a snapshot of file paths into the container when ready.
  - Save: service writes to SQLite and (if ready) also writes to `WebContainer.fs`.
  - Run: service spawns `node <path>` and pipes output to the terminal.

### 5. Terminal

- **Tech**: xterm.js + xterm-addon-fit.
- **Component**: `src/IDE/TerminalComponent.tsx`.
- **Connection**: UI passes a small terminal adapter (currently `terminalRef.write`) to the service.

## Intentionally Not Supported

- URL-driven file selection / deep-linking.
- Server-side execution.
