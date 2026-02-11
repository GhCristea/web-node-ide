# Worker Strategy

## Simplified Approach

We use **@sqlite.org/sqlite-wasm** in "Promiser Mode" (`sqlite3Worker1Promiser`).

This library manages its own dedicated Web Worker internally. All database operations called from the main thread (`db.ts`) are automatically serialized, sent to that worker, and executed off the main thread.

## Why we removed the custom worker layer

We initially built a `src/IDE/worker` layer that wrapped the database operations in *another* worker. This was determined to be:

1.  **Redundant**: Wrapping a worker-based library in another worker adds overhead.
2.  **Complex**: Required maintaining a custom message protocol (`INIT_DB`, `GET_FILES`, etc.).
3.  **Fragile**: Added more points of failure for serialization/deserialization.

## Current Architecture

```
[Main Thread]                   [SQLite Internal Worker]
IDEStore (UI)
   |
   v
ideService
   |
   v
db.ts (Imported Module)  ---->  sqlite3Worker1Promiser
                                     |
                                     v
                                   OPFS (Storage)
```

We adhere to **KISS** and **YAGNI**. We don't build workers until the profiler tells us we need them.
