# Technology Stack & Conventions

## Core

- **SolidJS**: Reactive UI library.
- **TypeScript**: Strict typing required.
- **Vite**: Build tool.

## UI

- **Layout**: `solid-resizable-panels`.
- **Icons**: `lucide-solid`.

## IDE Components

- **Editor**: `solid-monaco`.
- **Terminal**: `@xterm/xterm` (+ `@xterm/addon-fit`).

## Runtime & Storage

- **Runtime**: `@webcontainer/api`.
- **Persistence**: `@sqlite.org/sqlite-wasm` using OPFS when available.

## State Management

- **Store**: `zustand` (vanilla) with `solid-zustand` for reactivity.

## Conventions

- Keep SolidJS components presentational when possible; prefer pushing orchestration into the service layer (`src/IDE/service`).
- Avoid `any` unless interfacing with third-party APIs that lack good types.
