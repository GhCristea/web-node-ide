# Web Node IDE

A browser-based Node.js IDE that allows you to write, run, and execute Node.js code directly in your browser.

## Key Features

- **In-Browser Runtime**: Powered by **WebContainers**, enabling native `npm install` and node execution.
- **Persistent Storage**: **SQLite WASM + OPFS** ensures your files are saved reliably between sessions.
- **Service-Based Architecture**: Separation of concerns between UI, filesystem, and runtime logic.
- **Monaco Editor**: VS Code's editor engine with syntax highlighting and IntelliSense.
- **Xterm.js Terminal**: Fully integrated terminal for command output and interaction.

## Architecture

This project uses a **Service Layer Pattern** to decouple business logic from the SolidJS UI:

- **UI Layer (`IDEStore`)**: Manages view state (selected file, loading flags) using Zustand and connects components to the service.
- **Service Layer (`ideService`)**: Orchestrates file operations, database sync, and WebContainer execution.
- **Infrastructure (`db`, `webContainer`)**: Handles low-level persistence and runtime environments.

## Technologies

- **Core**: SolidJS, TypeScript, Vite
- **Runtime**: @webcontainer/api
- **Storage**: @sqlite.org/sqlite-wasm (OPFS)
- **Editor**: solid-monaco
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

   *Note: Must be served over HTTPS or localhost due to `SharedArrayBuffer` security requirements.*

## Usage

- **File Management**: Create files/folders via the explorer. Logic handles parent resolution automatically.
- **Execution**: Click "Run" to execute the active file. Output streams directly to the integrated terminal.
- **Persistence**: Files are auto-saved to OPFS. Use "Reset FS" to clear the database if needed.

## Requirements

- A Chromium-based browser (Chrome, Edge) for full WebContainer support.
- Cross-Origin Isolation headers (COOP/COEP) are required (handled by Vite config).

## License

MIT
