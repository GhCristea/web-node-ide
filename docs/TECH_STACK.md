# Technology Stack & Conventions

## Core

- **React**: Functional components with hooks.
- **TypeScript**: Strict typing required.
- **Vite**: Build tool.

## UI

- **Layout**: `react-resizable-panels`.
- **Icons**: `lucide-react`.

## IDE Components

- **Editor**: `@monaco-editor/react`.
- **Terminal**: `@xterm/xterm` (+ `@xterm/addon-fit`).

## Runtime & Storage

- **Runtime**: `@webcontainer/api`.
- **Persistence**: `@sqlite.org/sqlite-wasm` using OPFS when available.

## Conventions

- Keep React components presentational when possible; prefer pushing orchestration into the service layer (`src/IDE/service`).
- Avoid `any` unless interfacing with third-party APIs that lack good types.
