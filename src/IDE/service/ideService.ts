import type { WebContainer } from '@webcontainer/api'
import { buildTree, buildWebContainerTree, generatePaths } from './fileUtils'
import { fileSystemBridge } from './fileSystemBridge'
import type { FileMetadata, DB, TerminalHandle, FsKind, Id, ParentId, Content } from '../types'

export function createIDEService(deps: { db: DB; terminal: TerminalHandle }) {
  let _filesCache: FileMetadata[] = []

  const getPathFromCache = (fileId: Id) => {
    const file = _filesCache.find(f => f.id === fileId)
    if (!file) return null

    const parts = [file.name]
    let current = file
    while (current.parentId) {
      const parent = _filesCache.find(p => p.id === current.parentId)
      if (!parent) break
      parts.unshift(parent.name)
      current = parent
    }
    return parts.join('/')
  }

  const resolveParentId = (selectedFileId: Id | null, explicitParentId?: ParentId) => {
    if (explicitParentId !== undefined) {
      return explicitParentId
    }

    if (selectedFileId) {
      const selectedNode = _filesCache.find(f => f.id === selectedFileId)
      if (selectedNode) {
        return selectedNode.type === 'directory' ? selectedNode.id : selectedNode.parentId
      }
    }
    return null
  }

  return {
    initialize: deps.db.initDb,

    async loadFiles() {
      const allFiles = await deps.db.getFilesMetadata()
      _filesCache = allFiles
      const tree = buildTree(allFiles)
      return tree
    },

    async mountProjectFiles(webContainer: WebContainer) {
      if (!webContainer) return

      const pathsMap = generatePaths(_filesCache)
      const validFiles = _filesCache.filter(f => {
        if (f.type === 'directory') return false
        const path = pathsMap.get(f.id)
        return path && !path.split('/').includes('node_modules')
      })

      const ids = validFiles.map(f => f.id)

      const chunkSize = 100
      const mountTree: Record<string, string> = {}

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunkIds = ids.slice(i, i + chunkSize)
        const contents = await deps.db.getBatchFileContent(chunkIds)

        chunkIds.forEach(id => {
          const path = pathsMap.get(id)
          if (path && contents[id] !== undefined) {
            mountTree[path] = contents[id]
          }
        })
      }

      const tree = buildWebContainerTree(mountTree)
      await webContainer.mount(tree)
      console.log(`Mounted ${Object.keys(mountTree).length} files to WebContainer`)
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
      try {
        await Promise.all([deps.db.saveFileContent(id, content), fileSystemBridge.saveFile(id, content)])
      } catch {
        console.log('Failed to save file', id)
      }

      if (isWcReady) {
        const path = getPathFromCache(id)
        if (path) {
          await writeFile(path, content)
          deps.terminal.write(`Synced ${path}\r\n`)
        }
      }
    },

    async createNode(
      name: string,
      type: FsKind,
      selectedFileId: Id | null,
      explicitParentId?: ParentId,
      webContainer?: WebContainer | null
    ) {
      const parentId = resolveParentId(selectedFileId, explicitParentId)
      const newId = await deps.db.createFile(name, parentId, type, type === 'file' ? '' : '')

      if (webContainer) {
        let parentPath = ''
        if (parentId) {
          const parentPathStr = getPathFromCache(parentId)
          if (parentPathStr) parentPath = parentPathStr
        }

        const fullPath = parentPath ? `${parentPath}/${name}` : name

        if (type === 'directory') {
          await webContainer.fs.mkdir(fullPath)
        } else {
          await webContainer.fs.writeFile(fullPath, '')
        }
      }
      return newId
    },

    async deleteNode(id: Id, webContainer?: WebContainer | null) {
      const path = getPathFromCache(id)
      await deps.db.deleteFile(id)

      if (webContainer && path) {
        await webContainer.fs.rm(path, { recursive: true, force: true })
      }
    },

    async renameNode(id: Id, newName: string, webContainer?: WebContainer | null) {
      const oldPath = getPathFromCache(id)
      await deps.db.renameFile(id, newName)

      if (webContainer && oldPath) {
        const pathParts = oldPath.split('/')
        pathParts.pop()
        pathParts.push(newName)
        const newPath = pathParts.join('/')
        await webContainer.fs.rename(oldPath, newPath)
      }
    },

    async moveNode(id: Id, newParentId: ParentId, webContainer?: WebContainer | null) {
      const oldPath = getPathFromCache(id)
      await deps.db.moveFile(id, newParentId)

      if (webContainer && oldPath) {
        let newParentPath = ''
        if (newParentId) {
          const parent = _filesCache.find(f => f.id === newParentId)

          if (parent) {
            console.log('defined parent')
          }
          const p = getPathFromCache(newParentId)
          if (p) newParentPath = p
        }

        const fileName = oldPath.split('/').pop()
        const newPath = newParentPath ? `${newParentPath}/${fileName}` : fileName
        if (newPath) {
          await webContainer.fs.rename(oldPath, newPath)
        }
      }
    },

    async resetFileSystem() {
      if (confirm('Reset file system?')) {
        await deps.db.resetFileSystem()
        window.location.reload()
      }
    },

    async runFile(fileId: Id, isWcReady: boolean, webContainer: WebContainer) {
      if (!isWcReady || !webContainer) return

      const path = getPathFromCache(fileId)
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

    async mountFromLocal(webContainer: WebContainer) {
      try {
        const handle = await fileSystemBridge.openDirectory()
        await fileSystemBridge.storeHandle(handle)

        const { files, contents } = await fileSystemBridge.readDirectory(handle)

        await deps.db.resetFileSystem()

        for (const file of files) {
          const content = file.type === 'file' ? contents[file.id] || '' : ''
          await deps.db.createFile(file.name, file.parentId, file.type, content, file.id)
        }

        _filesCache = await deps.db.getFilesMetadata()
        const treeRoots = buildTree(_filesCache)

        await this.mountProjectFiles(webContainer)

        return treeRoots
      } catch (error) {
        if ((error as Error).name === 'AbortError') return null
        console.error('Failed to mount from local:', error)
        throw error
      }
    },

    async restoreLocalSession(webContainer: WebContainer) {
      const handle = await fileSystemBridge.getHandle()
      if (!handle) return false

      const hasPerm = await fileSystemBridge.verifyPermission(handle, 'readwrite')
      if (!hasPerm) return false

      try {
        const { files, contents } = await fileSystemBridge.readDirectory(handle)

        await deps.db.resetFileSystem()

        for (const file of files) {
          const content = file.type === 'file' ? contents[file.id] || '' : ''
          await deps.db.createFile(file.name, file.parentId, file.type, content, file.id)
        }

        _filesCache = await deps.db.getFilesMetadata()
        await this.mountProjectFiles(webContainer)
        return buildTree(_filesCache)
      } catch (e) {
        console.error('Failed to restore session:', e)
        return false
      }
    }
  }
}
