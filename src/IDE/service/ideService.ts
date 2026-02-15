import type { WebContainer } from '@webcontainer/api'
import { buildTree, buildWebContainerTree, generatePaths, isValidFileName } from './fileUtils'
import { fileSystemBridge } from './fileSystemBridge'
import { showToast } from '../../toasts/toastStore'
import type { DB, TerminalHandle, FsKind, Id, ParentId, Content, FileNode } from '../types'

export function createIDEService(deps: { db: DB; terminal: TerminalHandle }) {
  type TreeUpdateCallback = (tree: FileNode[]) => void

  const getFilePath = async (fileId: Id) => {
    const files = await deps.db.getFilesMetadata()
    const paths = generatePaths(files)
    return paths.get(fileId) || null
  }

  const resolveParentId = async (selectedFileId: Id | null, explicitParentId?: ParentId) => {
    if (explicitParentId !== undefined) return explicitParentId
    if (selectedFileId) {
      const files = await deps.db.getFilesMetadata()
      const node = files.find(f => f.id === selectedFileId)
      if (node) return node.type === 'directory' ? node.id : node.parentId
    }
    return null
  }

  const getEntryStats = async (wc: WebContainer, filename: string) => {
    try {
      const parts = filename.split('/')
      const name = parts.pop()
      const dir = parts.join('/') || '/'
      const entries = await wc.fs.readdir(dir, { withFileTypes: true })
      return entries.find(e => e.name === name)
    } catch {
      return undefined
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const handleFsEvent = async (filename: string, webContainer: WebContainer, onTreeUpdate: TreeUpdateCallback) => {
    if (!filename || filename.includes('node_modules') || filename.includes('.git')) return

    try {
      const stats = await getEntryStats(webContainer, filename)

      const existingFiles = await deps.db.getFilesMetadata()
      const paths = generatePaths(existingFiles)

      const pathMap = new Map<string, Id>()
      paths.forEach((p, id) => pathMap.set(p, id))

      const existingId = pathMap.get(filename)

      if (stats) {
        const parentPath = filename.split('/').slice(0, -1).join('/')
        const name = filename.split('/').pop()!
        const parentId = parentPath ? pathMap.get(parentPath) || null : null

        if (stats.isDirectory()) {
          if (!existingId) await deps.db.createFile(name, parentId, 'directory', '')
        } else if (stats.isFile()) {
          const content = await webContainer.fs.readFile(filename, 'utf-8')
          if (!existingId) {
            await deps.db.createFile(name, parentId, 'file', content)
          } else {
            await deps.db.saveFileContent(existingId, content)
          }
        }
      } else if (existingId) {
        await deps.db.deleteFile(existingId)
      }

      if (debounceTimer) clearTimeout(debounceTimer)

      debounceTimer = setTimeout(async () => {
        const allFiles = await deps.db.getFilesMetadata()
        onTreeUpdate(buildTree(allFiles))
        debounceTimer = null
      }, 50)
    } catch (err) {
      console.error('[FS Sync Error]', err)
      showToast('File system sync error', 'error')
    }
  }

  return {
    initialize: deps.db.initDb,

    async loadFiles() {
      const allFiles = await deps.db.getFilesMetadata()
      const tree = buildTree(allFiles)
      return tree
    },

    async mountProjectFiles(webContainer: WebContainer, onTreeUpdate: TreeUpdateCallback) {
      if (!webContainer) return

      const allFiles = await deps.db.getFilesMetadata()
      const paths = generatePaths(allFiles)

      const validFiles = allFiles.filter(f => {
        if (f.type === 'directory') return false
        const path = paths.get(f.id)
        return path && !path.split('/').includes('node_modules')
      })

      const ids = validFiles.map(f => f.id)

      const chunkSize = 100
      const mountTree: Record<string, string> = {}

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunkIds = ids.slice(i, i + chunkSize)
        const contents = await deps.db.getBatchFileContent(chunkIds)

        chunkIds.forEach(id => {
          const path = paths.get(id)
          if (path && contents[id] !== undefined) {
            mountTree[path] = contents[id]
          }
        })
      }

      const tree = buildWebContainerTree(mountTree)
      await webContainer.mount(tree)
      console.log(`Mounted ${Object.keys(mountTree).length} files to WebContainer`)

      webContainer.fs.watch('/', { recursive: true }, (_event, filename) => {
        handleFsEvent(filename as string, webContainer, onTreeUpdate)
      })
      console.log('Started fs.watch on /')
    },

    async _syncAndMount(
      handle: FileSystemDirectoryHandle,
      webContainer: WebContainer,
      onTreeUpdate: TreeUpdateCallback
    ) {
      const { files, contents } = await fileSystemBridge.readDirectory(handle)

      await deps.db.resetFileSystem()

      for (const file of files) {
        const content = file.type === 'file' ? contents[file.id] || '' : ''
        await deps.db.createFile(file.name, file.parentId, file.type, content, file.id)
      }

      const allFiles = await deps.db.getFilesMetadata()
      const treeRoots = buildTree(allFiles)

      await this.mountProjectFiles(webContainer, onTreeUpdate)

      return treeRoots
    },

    async getFileContent(id: Id) {
      return deps.db.getFileContent(id)
    },

    async saveFile(
      id: Id,
      content: Content,
      isWcReady: boolean,
      writeFile: (path: string, content: Content) => Promise<void>
    ) {
      if (isWcReady) {
        const path = await getFilePath(id)
        if (path) {
          await writeFile(path, content)
        }
      } else {
        await deps.db.saveFileContent(id, content)

        try {
          await fileSystemBridge.saveFile(id, content)
        } catch (err) {
          console.error('Failed to save file to local storage', err)
          showToast('Failed to save file to local disk', 'error')
        }
      }
    },

    async createNode(
      name: string,
      type: FsKind,
      selectedFileId: Id | null,
      explicitParentId: ParentId | undefined,
      webContainer?: WebContainer | null
    ) {
      if (!isValidFileName(name)) {
        throw new Error(`Invalid file name: "${name}"`)
      }

      const parentId = await resolveParentId(selectedFileId, explicitParentId)

      if (webContainer) {
        const parentPath = parentId ? (await getFilePath(parentId)) || '' : ''
        const fullPath = parentPath ? `${parentPath}/${name}` : name

        if (type === 'directory') await webContainer.fs.mkdir(fullPath)
        else await webContainer.fs.writeFile(fullPath, '')
        return
      }

      await deps.db.createFile(name, parentId, type, '')
    },

    async deleteNode(id: Id, webContainer?: WebContainer | null) {
      if (webContainer) {
        const path = await getFilePath(id)
        if (path) {
          await webContainer.fs.rm(path, { recursive: true, force: true })
        }
        return
      }

      await deps.db.deleteFile(id)
    },

    async renameNode(id: Id, newName: string, webContainer?: WebContainer | null) {
      if (webContainer) {
        const oldPath = await getFilePath(id)
        if (oldPath) {
          const pathParts = oldPath.split('/')
          pathParts.pop()
          pathParts.push(newName)
          const newPath = pathParts.join('/')
          await webContainer.fs.rename(oldPath, newPath)
        }
        return
      }

      await deps.db.renameFile(id, newName)
    },

    async moveNode(id: Id, newParentId: ParentId, webContainer?: WebContainer | null) {
      if (webContainer) {
        const oldPath = await getFilePath(id)
        if (oldPath) {
          let newParentPath = ''
          if (newParentId) {
            const p = await getFilePath(newParentId)
            if (p) newParentPath = p
          }
          const fileName = oldPath.split('/').pop() as string
          const newPath = newParentPath ? `${newParentPath}/${fileName}` : fileName
          await webContainer.fs.rename(oldPath, newPath)
        }
        return
      }

      await deps.db.moveFile(id, newParentId)
    },

    async resetFileSystem() {
      if (confirm('Reset file system?')) {
        await deps.db.resetFileSystem()
        window.location.reload()
      }
    },

    async runFile(fileId: Id, isWcReady: boolean, webContainer: WebContainer) {
      if (!isWcReady || !webContainer) return

      const path = await getFilePath(fileId)
      if (!path) return

      deps.terminal.write(`\r\n\x1b[1;36m➤ ${new Date().toUTCString()} Executing ${path}...\x1b[0m\r\n`)

      try {
        const process = await webContainer.spawn('node', [path])
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              deps.terminal.write(data)
            }
          })
        )
        const exitCode = await process.exit
        deps.terminal.write(`\r\n\x1b[1;33mProcess exited with code ${exitCode}\x1b[0m\r\n`)
      } catch (err) {
        deps.terminal.write(`\x1b[1;31mError: ${err}\x1b[0m\r\n`)
      }
    },

    async mountFromLocal(webContainer: WebContainer, onTreeUpdate: TreeUpdateCallback) {
      try {
        const handle = await fileSystemBridge.openDirectory()
        await fileSystemBridge.storeHandle(handle)
        return await this._syncAndMount(handle, webContainer, onTreeUpdate)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return null
        console.error('Failed to mount from local:', error)
        showToast('Failed to mount local directory', 'error')
        throw error
      }
    },

    async restoreLocalSession(webContainer: WebContainer, onTreeUpdate: TreeUpdateCallback) {
      const handle = await fileSystemBridge.getHandle()
      if (!handle) return false

      const hasPerm = await fileSystemBridge.verifyPermission(handle, 'readwrite')
      if (!hasPerm) return false

      try {
        return await this._syncAndMount(handle, webContainer, onTreeUpdate)
      } catch (e) {
        console.error('Failed to restore session:', e)
        showToast('Failed to restore previous session', 'error')
        return false
      }
    }
  }
}
