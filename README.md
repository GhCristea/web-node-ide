# Web Node IDE

This project is a browser-based Node.js IDE that allows you to write, run, and execute Node.js code directly in your browser. It leverages WebContainer for a full Node.js runtime, Monaco Editor for a rich coding experience, and SQLite WASM with OPFS for persistent file storage.

## Features

- **In-Browser Node.js Runtime**: powered by WebContainers, allowing you to run Node.js commands like `npm install` and `node index.js` directly in the browser.
- **Monaco Code Editor**: Professional-grade code editing with syntax highlighting and IntelliSense.
- **Integrated Terminal**: Includes a fully functional terminal based on xterm.js for interacting with the runtime.
- **Persistent Storage**: Uses Origin Private File System (OPFS) via SQLite WASM to persist your files and project structure across sessions.
- **File Explorer**: Create, manage, and organize files and folders with ease.

## Technologies Used

- **React**: UI library for building the interface.
- **WebContainer API**: Provides the in-browser Node.js runtime environment.
- **Monaco Editor**: The code editor that powers VS Code.
- **xterm.js**: For the terminal component.
- **SQLite WASM**: For efficient and persistent data storage.
- **Chakra UI**: For a responsive and accessible user interface.
- **Vite**: For fast build tooling.

## Prerequisites

- **Modern Browser**: Chrome, Edge, or another Chromium-based browser is required for WebContainer support.
- **HTTPS or Localhost**: The application must be served over HTTPS or from localhost due to security requirements (Cross-Origin Isolation).

## Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/GhCristea/web-node-ide
   cd web-node-ide
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173`.

## Usage

- **Creating Files**: Use the buttons in the file explorer to create new files or folders.
- **Editing**: Select a file to open it in the editor. Changes are saved automatically on focus loss or manually via the "Save File" button.
- **Running Code**: Click the "Run" button to execute the currently open file in the Node.js environment.
- **Terminal**: Use the integrated terminal to interact with the environment.

## Troubleshooting

- **WebContainer Issues**: Ensure you are using a Chromium-based browser. WebContainers require `SharedArrayBuffer` which necessitates Cross-Origin Isolation headers (COOP/COEP).
- **FileSystem**: If you encounter issues with file persistence, try resetting the file system using the "Reset FS" button.

## License

MIT
