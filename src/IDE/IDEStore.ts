import { WebContainer } from '@webcontainer/api'
import * as db from './db'
import { createIDEService } from './service/ideService'
import type { FileNode } from '../types/fileSystem'
import { createWithSignal } from 'solid-zustand'

export interface IDEState {
  files: FileNode[]
  selectedFileId: string | null
  fileContent: string
  isDbReady: boolean
  isRunning: boolean
  isLoading: boolean
  error: string | null
  webContainer: WebContainer | null
  isWcReady: boolean
  terminal: { write: (data: string) => void } | null

  setTerminal: (terminal: { write: (data: string) => void }) => void
  initialize: () => Promise<void>
  selectFile: (id: string | null) => void
  updateFileContent: (content: string) => void
  saveFile: () => Promise<void>
  createFile: (name: string, type: 'file' | 'folder', parentId?: string | null) => Promise<void>
  renameNode: (id: string, newName: string) => Promise<void>
  moveNode: (id: string, newParentId: string | null) => Promise<void>
  deleteNode: (id: string) => Promise<void>
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
        await db.initDb()
        set({ isDbReady: true })

        try {
          const wc = await WebContainer.boot()
          set({ webContainer: wc, isWcReady: true })
          get().terminal?.write('\x1b[32m✓ Node.js Environment Ready\x1b[0m\r\n')
        } catch (e) {
          set({ error: String(e) })
        }

        const tree = await service.loadFiles()

        const wc = get().webContainer
        if (wc) {
          await service.mountProjectFiles(wc)
        }

        set({ files: tree, isLoading: false })
      } catch (err) {
        set({ error: `DB Init Failed: ${err}`, isLoading: false })
      }
    },

    selectFile: async (id: string | null) => {
      set({ selectedFileId: id })
      if (!id) {
        set({ fileContent: '' })
        return
      }
      const content = await service.getFileContent(id)
      set({ fileContent: content })
    },

    updateFileContent: (content: string) => {
      set({ fileContent: content })
    },

    saveFile: async () => {
      const { selectedFileId, fileContent, isWcReady, webContainer } = get()
      if (!selectedFileId) return

      try {
        await service.saveFile(selectedFileId, fileContent, isWcReady, async (path: string, content: string) => {
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

        const tree = await service.loadFiles()

        set({ files: tree })
      } catch (err) {
        set({ error: `Failed to create ${type}: ${err}` })
      }
    },

    renameNode: async (id, newName) => {
      try {
        const { webContainer } = get()
        await service.renameNode(id, newName, webContainer)
        const tree = await service.loadFiles()
        set({ files: tree })
      } catch (err) {
        console.error(err)
        set({ error: 'Failed to rename' })
      }
    },

    moveNode: async (id, newParentId) => {
      try {
        const { webContainer } = get()
        await service.moveNode(id, newParentId, webContainer)
        const tree = await service.loadFiles()
        set({ files: tree })
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
        const tree = await service.loadFiles()
        set({ files: tree })
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
        const tree = await service.mountFromLocal(webContainer)
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
