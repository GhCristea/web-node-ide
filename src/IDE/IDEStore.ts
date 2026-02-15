import { createStore } from 'solid-js/store'
import { WebContainer } from '@webcontainer/api'
import * as db from './db'
import { createIDEService } from './service/ideService'
import type { Id, FileNode, FsKind, TerminalHandle, ParentId, Content } from './types'

export interface IDEState {
  files: FileNode[]
  selectedFileId: Id | null
  fileContent: Content
  isDbReady: boolean
  isRunning: boolean
  isLoading: boolean
  error: string | null
  webContainer: WebContainer | null
  isWcReady: boolean
  terminal: TerminalHandle | null
}

export const [ideStore, setIdeStore] = createStore<IDEState>({
  files: [],
  selectedFileId: null,
  fileContent: '',
  isDbReady: false,
  isRunning: false,
  isLoading: true,
  error: null,
  webContainer: null,
  isWcReady: false,
  terminal: null
})

const terminalProxy = {
  write: (data: string) => {
    ideStore.terminal?.write(data)
  }
}

const service = createIDEService({ db, terminal: terminalProxy })

const onTreeUpdate = (tree: FileNode[]) => {
  setIdeStore('files', tree)
}

export const setTerminal = (terminal: TerminalHandle) => {
  setIdeStore({ terminal })
}

export const initialize = async () => {
  try {
    const dbPromise = db.initDb().then(() => {
      setIdeStore({ isDbReady: true })
    })

    const wcPromise = WebContainer.boot()
      .then(wc => {
        setIdeStore({ webContainer: wc, isWcReady: true })
        ideStore.terminal?.write('\x1b[32m✓ Node.js Environment Ready\x1b[0m\r\n')
      })
      .catch(e => {
        setIdeStore({ error: String(e) })
      })

    await Promise.all([dbPromise, wcPromise])

    if (ideStore.isDbReady) {
      try {
        const tree = await service.loadFiles()
        setIdeStore({ files: tree, isLoading: false })

        const wc = ideStore.webContainer
        if (wc) {
          await service.mountProjectFiles(wc, onTreeUpdate)
        }
      } catch (fileErr) {
        setIdeStore({ error: `File Load Failed: ${fileErr}`, isLoading: false })
      }
    }
  } catch (err) {
    setIdeStore({ error: `Initialization Failed: ${err}`, isLoading: false })
  }
}

export const selectFile = async (id: Id | null) => {
  setIdeStore({ selectedFileId: id })
  if (!id) {
    setIdeStore({ fileContent: '' })
    return
  }
  const content = await service.getFileContent(id)
  setIdeStore({ fileContent: content })
}

export const updateFileContent = (content: Content) => {
  setIdeStore({ fileContent: content })
}

export const saveFile = async () => {
  const { selectedFileId, fileContent, isWcReady, webContainer } = ideStore
  if (!selectedFileId) return

  try {
    await service.saveFile(selectedFileId, fileContent, isWcReady, async (path, content) => {
      if (webContainer) await webContainer.fs.writeFile(path, content)
    })
  } catch (err) {
    console.error(err)
    setIdeStore({ error: 'Failed to save file' })
  }
}

export const createFile = async (name: string, type: FsKind, explicitParentId?: ParentId) => {
  try {
    const { selectedFileId, webContainer } = ideStore
    await service.createNode(name, type, selectedFileId, explicitParentId, webContainer)
  } catch (err) {
    setIdeStore({ error: `Failed to create ${type}: ${err}` })
  }
}

export const renameNode = async (id: Id, newName: string) => {
  try {
    const { webContainer } = ideStore
    await service.renameNode(id, newName, webContainer)
  } catch (err) {
    console.error(err)
    setIdeStore({ error: 'Failed to rename' })
  }
}

export const moveNode = async (id: Id, newParentId: ParentId) => {
  try {
    const { webContainer } = ideStore
    await service.moveNode(id, newParentId, webContainer)
  } catch (err) {
    console.error(err)
    setIdeStore({ error: 'Failed to move' })
  }
}

export const deleteNode = async (id: Id) => {
  try {
    const { webContainer, selectedFileId } = ideStore
    await service.deleteNode(id, webContainer)
    if (selectedFileId === id) {
      setIdeStore({ selectedFileId: null })
    }
  } catch (err) {
    console.error(err)
    setIdeStore({ error: 'Failed to delete' })
  }
}

export const mountFromLocal = async () => {
  try {
    const { webContainer } = ideStore
    if (!webContainer) return

    setIdeStore({ isLoading: true })
    const tree = await service.mountFromLocal(webContainer, onTreeUpdate)
    if (tree) {
      setIdeStore({ files: tree })
      ideStore.terminal?.write('\x1b[32m✓ Mounted local directory\x1b[0m\r\n')
    }
  } catch (err) {
    setIdeStore({ error: `Mount failed: ${err}` })
  } finally {
    setIdeStore({ isLoading: false })
  }
}

export const run = async () => {
  const { selectedFileId, isWcReady, webContainer } = ideStore
  if (!selectedFileId || !isWcReady || !webContainer) return

  setIdeStore({ isRunning: true })
  try {
    await service.runFile(selectedFileId, isWcReady, webContainer)
  } finally {
    setIdeStore({ isRunning: false })
  }
}

export const reset = async () => {
  await service.resetFileSystem()
}
