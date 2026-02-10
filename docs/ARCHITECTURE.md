# System Architecture

## Core Concepts

This application simulates a full IDE environment in the browser. It does NOT have a traditional backend.

### 1. Unified State Management (IDEStore)

- **Role**: Central coordinator for the entire IDE.
- **Location**: `src/IDE/IDEStore.tsx` (Provider) and `src/IDE/IDEContext.ts` (Context).
- **Responsibilities**:
  - Manages file tree state and selected file.
  - Handles URL persistence for navigation (`?file=path/to/file`).
  - Orchestrates synchronization between the DB and WebContainer.
  - Exposes actions like `saveFile`, `createFile`, `run`, and `reset`.

### 2. File System (Source of Truth)

- **Storage**: SQLite via OPFS (Origin Private File System).
- **Access**: All file CRUD operations must go through `src/IDE/db.ts`.
- **Constraint**: Do not try to use the native browser `fs` API directly; use the database helpers.
- **Optimization**: File list fetches structural data; file content is fetched on demand to reduce memory usage.

### 3. Runtime Environment (WebContainers)

- **Role**: Executes Node.js code (user projects).
- **Integration**: Managed via `src/IDE/useWebContainer.ts` hook.
- **Syncing**:
  - *Boot*: Auto-boots on mount.
  - *Mount*: `IDEStore` hydrates the container with files from SQLite on ready.
  - *Write*: `IDEStore` writes to BOTH SQLite and `WebContainer.fs` on save.

### 4. Terminal

- **Tech**: xterm.js + xterm-addon-fit.
- **Component**: `src/TerminalComponent.tsx`.
- **Connection**: `IDEStore` pipes output from `WebContainer` processes directly to the xterm instance via a ref.
