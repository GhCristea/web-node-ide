# FileSystemService API Guide

## Overview

The `FileSystemService` provides a virtual file system backed by IndexedDB. It's compatible with WebContainers' file system API, making it easy to swap implementations or migrate to WebContainers later.

## Initialization

```typescript
import { FileSystemService } from './core/services'

const fs = new FileSystemService()
await fs.initialize() // Initializes IndexedDB
```

Or use the service registry:

```typescript
import { initializeServices, registry } from './core/services'

await initializeServices()
const fs = registry.get('filesystem')
```

## File System Tree Format

Files and directories are represented using WebContainers' tree structure:

```typescript
import type { FileSystemTree } from './core/types'

const files: FileSystemTree = {
  'package.json': {
    file: {
      contents: '{"name": "my-app"}'
    }
  },
  'src': {
    directory: {
      'main.js': {
        file: {
          contents: 'console.log("hello")'
        }
      },
      'utils.js': {
        file: {
          contents: 'export const add = (a, b) => a + b'
        }
      }
    }
  }
}
```

## Mounting Files

### Mount at root

```typescript
await fs.mount(files)
```

### Mount to specific directory

```typescript
// Create mount point first
await fs.mkdir('/projects/myproject', { recursive: true })

// Mount files there
await fs.mount(files, { mountPoint: '/projects/myproject' })
```

## Reading Files

### Read as UTF-8 string

```typescript
const content = await fs.readFile('/src/main.js', 'utf-8')
console.log(content) // string
```

### Read as binary (UInt8Array)

```typescript
const buffer = await fs.readFile('/src/main.js')
console.log(buffer) // UInt8Array
```

## Writing Files

### Write string content

```typescript
await fs.writeFile('/src/app.js', 'console.log("app")')
```

### Write binary content

```typescript
const data = new Uint8Array([1, 2, 3, 4])
await fs.writeFile('/data/binary.bin', data)
```

## Reading Directories

### List files and directories

```typescript
const names = await fs.readdir('/src')
console.log(names) // ['main.js', 'utils.js', ...]
```

### Get detailed entry information

```typescript
const entries = await fs.readdir('/src', { withFileTypes: true })

entries.forEach(entry => {
  console.log(entry.name)
  console.log(entry.isFile()) // boolean
  console.log(entry.isDirectory()) // boolean
})
```

## Creating Directories

### Create single directory

```typescript
await fs.mkdir('/src')
// Error if parent doesn't exist
```

### Create nested directories

```typescript
await fs.mkdir('/src/components/ui/forms', { recursive: true })
```

## Deleting Files and Directories

### Delete file

```typescript
await fs.rm('/src/app.js')
```

### Delete directory with contents

```typescript
await fs.rm('/src', { recursive: true })
```

### Force delete (ignore if doesn't exist)

```typescript
await fs.rm('/nonexistent', { force: true })
```

## Clearing All Files

```typescript
await fs.clear()
```

## Usage in Components

### FileTreeComponent

```typescript
import { FileTreeComponent } from './ui/file-tree'
import { registry } from './core/services'

const container = document.getElementById('sidebar')
const filesystem = registry.get('filesystem')

const fileTree = new FileTreeComponent(container, filesystem)
```

The component reads the file system and displays it as a tree with expand/collapse UI.

### EditorComponent

When a file is selected in the tree, dispatch the OPEN event:

```typescript
const path = '/src/main.js'
const content = await fs.readFile(path, 'utf-8')
editorActor.send({ type: 'OPEN', path, content })
```

## Error Handling

Most operations throw errors if paths don't exist:

```typescript
try {
  const content = await fs.readFile('/nonexistent/file.js')
} catch (error) {
  console.error('File not found:', error.message)
}
```

## Performance Considerations

- **IndexedDB limitations**: Large files (>50MB) may cause performance issues
- **Path normalization**: All paths normalized to `/<segments>` format
- **Recursive operations**: Use `recursive: true` for nested directories
- **Mount time**: First mount is slower due to IndexedDB writes

## Migration to WebContainers

To use WebContainers API instead of IndexedDB:

1. Create `WebContainersFileSystemAdapter` implementing `FileSystemService` interface
2. Use same method signatures: `readFile()`, `writeFile()`, `readdir()`, `mkdir()`, `rm()`
3. Swap in service registry

```typescript
// Future: seamless swap
const fs = new WebContainersFileSystemAdapter(webcontainerInstance)
await initializeServices() // Uses new adapter
```

## Example: Demo Project

```typescript
import type { FileSystemTree } from './core/types'
import { FileSystemService } from './core/services'

const demoProject: FileSystemTree = {
  'package.json': {
    file: { contents: '{"name": "demo"}' }
  },
  'src': {
    directory: {
      'index.js': {
        file: { contents: 'console.log("hello")' }
      }
    }
  }
}

const fs = new FileSystemService()
await fs.initialize()
await fs.mount(demoProject)

// Now files are in the virtual file system
const content = await fs.readFile('/src/index.js', 'utf-8')
console.log(content)
```
