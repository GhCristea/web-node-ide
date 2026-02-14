import { WebContainer } from '@webcontainer/api'
import * as db from './db'
import { createIDEService } from './service/ideService'
import type { Id, FileNode, FsKind, TerminalHandle, ParentId, Content } from './types'
import { createWithSignal } from 'solid-zustand'

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

  setTerminal: (terminal: TerminalHandle) => void
  initialize: () => Promise<void>
  selectFile: (id: Id | null) => void
  updateFileContent: (content: Content) => void
  saveFile: () => Promise<void>
  createFile: (name: string, type: FsKind, parentId?: ParentId) => Promise<void>
  renameNode: (id: Id, newName: string) => Promise<void>
  moveNode: (id: Id, newParentId: ParentId) => Promise<void>
  deleteNode: (id: Id) => Promise<void>
  mountFromLocal: () => Promise<void>
  run: () => Promise<void>
  reset: () => Promise<void>
}

export const useIDEStore = createWithSignal<IDEState>((set, get) => {
  const terminalProxy = {
    write: (data: string) => {
      get().terminal?.write(data)
    }
  }

  const service = createIDEService({ db, terminal: terminalProxy })

  const onTreeUpdate = (tree: FileNode[]) => {
    set({ files: tree })
  }

  return {
    files: [],
    selectedFileId: null,
    fileContent: '',
    isDbReady: false,
    isRunning: false,
    isLoading: true,
    error: null,
    webContainer: null,
    isWcReady: false,
    terminal: null,

    setTerminal: terminal => set({ terminal }),

    initialize: async () => {
      try {
        const dbPromise = db.initDb().then(() => {
          set({ isDbReady: true })
        })

        const wcPromise = WebContainer.boot()
          .then(wc => {
            set({ webContainer: wc, isWcReady: true })
            get().terminal?.write('\x1b[32m✓ Node.js Environment Ready\x1b[0m\r\n')
          })
          .catch(e => {
            set({ error: String(e) })
          })

        await Promise.all([dbPromise, wcPromise])

        if (get().isDbReady) {
          try {
            const tree = await service.loadFiles()
            set({ files: tree, isLoading: false })

            const wc = get().webContainer
            if (wc) {
              await service.mountProjectFiles(wc, onTreeUpdate)
            }
          } catch (fileErr) {
            set({ error: `File Load Failed: ${fileErr}`, isLoading: false })
          }
        }
      } catch (err) {
        set({ error: `Initialization Failed: ${err}`, isLoading: false })
      }
    },

    selectFile: async (id: Id | null) => {
      set({ selectedFileId: id })
      if (!id) {
        set({ fileContent: '' })
        return
      }
      const content = await service.getFileContent(id)
      set({ fileContent: content })
    },

    updateFileContent: (content: Content) => {
      set({ fileContent: content })
    },

    saveFile: async () => {
      const { selectedFileId, fileContent, isWcReady, webContainer } = get()
      if (!selectedFileId) return

      try {
        await service.saveFile(selectedFileId, fileContent, isWcReady, async (path, content) => {
          if (webContainer) await webContainer.fs.writeFile(path, content)
        })
      } catch (err) {
        console.error(err)
        set({ error: 'Failed to save file' })
      }
    },

    createFile: async (name, type, explicitParentId) => {
      try {
        const { selectedFileId, webContainer } = get()
        await service.createNode(name, type, selectedFileId, explicitParentId, webContainer)
      } catch (err) {
        set({ error: `Failed to create ${type}: ${err}` })
      }
    },

    renameNode: async (id, newName) => {
      try {
        const { webContainer } = get()
        await service.renameNode(id, newName, webContainer)
      } catch (err) {
        console.error(err)
        set({ error: 'Failed to rename' })
      }
    },

    moveNode: async (id, newParentId) => {
      try {
        const { webContainer } = get()
        await service.moveNode(id, newParentId, webContainer)
      } catch (err) {
        console.error(err)
        set({ error: 'Failed to move' })
      }
    },

    deleteNode: async id => {
      try {
        const { webContainer, selectedFileId } = get()
        await service.deleteNode(id, webContainer)
        if (selectedFileId === id) {
          set({ selectedFileId: null })
        }
      } catch (err) {
        console.error(err)
        set({ error: 'Failed to delete' })
      }
    },

    mountFromLocal: async () => {
      try {
        const { webContainer } = get()
        if (!webContainer) return

        set({ isLoading: true })
        const tree = await service.mountFromLocal(webContainer, onTreeUpdate)
        if (tree) {
          set({ files: tree })
          get().terminal?.write('\x1b[32m✓ Mounted local directory\x1b[0m\r\n')
        }
      } catch (err) {
        set({ error: `Mount failed: ${err}` })
      } finally {
        set({ isLoading: false })
      }
    },

    run: async () => {
      const { selectedFileId, isWcReady, webContainer } = get()
      if (!selectedFileId || !isWcReady || !webContainer) return

      set({ isRunning: true })
      try {
        await service.runFile(selectedFileId, isWcReady, webContainer)
      } finally {
        set({ isRunning: false })
      }
    },

    reset: async () => {
      await service.resetFileSystem()
    }
  }
})
