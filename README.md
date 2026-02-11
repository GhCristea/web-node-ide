# Web Node IDE

A browser-based Node.js IDE that allows you to write, run, and execute Node.js code directly in your browser.

## Key Features

- **In-Browser Runtime**: Powered by **WebContainers**, enabling native `npm install` and node execution.
- **Worker-Offloaded Storage**: **SQLite WASM + OPFS** in a Web Worker ensures non-blocking file operations.
- **Service-Based Architecture**: Clean separation between UI, orchestration, and infrastructure.
- **Monaco Editor**: VS Code's editor engine with syntax highlighting and IntelliSense.
- **Xterm.js Terminal**: Fully integrated terminal for command output and interaction.

## Architecture

This project uses a **Service Layer Pattern** with **Worker-Based Persistence**:

- **UI Layer (`IDEStore`)**: React state management for view concerns (selected file, loading flags).
- **Service Layer (`ideService`)**: Orchestrates file operations, WebContainer execution, and coordinates between layers.
- **Worker Layer (`DBWorkerClient`)**: Runs SQLite operations in a Web Worker to keep the main thread responsive.
- **Infrastructure**: WebContainer (main thread), SQLite WASM (worker thread).

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [docs/WORKER.md](./docs/WORKER.md) for detailed design.

## Technologies

- **Core**: React 19, TypeScript, Vite
- **Runtime**: @webcontainer/api
- **Storage**: @sqlite.org/sqlite-wasm (OPFS in Web Worker)
- **Editor**: @monaco-editor/react
- **Terminal**: @xterm/xterm

## Setup & Running

1. **Clone & Install**
   ```bash
   git clone https://github.com/GhCristea/web-node-ide
   cd web-node-ide
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```
   *Note: Must be served over HTTPS or localhost due to `SharedArrayBuffer` and Cross-Origin Isolation requirements.*

## Usage

- **File Management**: Create files/folders via the explorer. Parent resolution handled automatically.
- **Execution**: Click "Run" to execute the active file. Output streams to the integrated terminal.
- **Persistence**: Files auto-save to OPFS via worker. Use "Reset FS" to clear the database.

## Requirements

- A Chromium-based browser (Chrome, Edge) for full WebContainer + OPFS support.
- Cross-Origin Isolation headers (COOP/COEP) — handled by Vite config.

## License

MIT
