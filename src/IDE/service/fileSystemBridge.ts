import { get, set } from 'idb-keyval'
import type { FileMetadata, Id, ParentId, Content } from '../types'

type FsFileHandle = FileSystemFileHandle
type FsFolderHandle = FileSystemDirectoryHandle
type FsEntryHandle = FsFileHandle | FsFolderHandle

const fileHandles = new Map<Id, FsFileHandle>()
const folderHandles = new Map<Id, FsFolderHandle>()

const generateId = () => crypto.randomUUID()

export const fileSystemBridge = {
  async openDirectory() {
    const handle = await window.showDirectoryPicker()
    return handle
  },

  async readDirectory(rootHandle: FsFolderHandle) {
    fileHandles.clear()
    folderHandles.clear()

    const files: FileMetadata[] = []
    const contents: Record<Id, Content> = {}

    const processEntry = async <T extends FsEntryHandle>(entry: T, parentId: ParentId) => {
      const id = generateId()
      const isFile = entry.kind === 'file'
      const name = entry.name

      files.push({ id, name, parentId, type: isFile ? 'file' : 'directory', updated_at: new Date().toISOString() })

      if (isFile) {
        fileHandles.set(id, entry)

        try {
          const file = await entry.getFile()
          const text = await file.text()
          contents[id] = text
        } catch (error) {
          console.error(`Failed to read file ${name}:`, error)

          contents[id] = ''
        }
      } else {
        folderHandles.set(id, entry)

        if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.DS_Store') {
          return
        }

        for await (const child of entry.values()) {
          await processEntry(child, id)
        }
      }
    }

    for await (const entry of rootHandle.values()) {
      await processEntry(entry, null)
    }

    return { files, contents }
  },

  async saveFile(id: Id, content: Content) {
    const handle = fileHandles.get(id)
    if (!handle) {
      console.warn(`No file handle found for ${id}. Skipping save to disk.`)
      return
    }

    try {
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
    } catch (error) {
      console.error(`Failed to save file ${id}:`, error)
      throw error
    }
  },

  async storeHandle(handle: FileSystemDirectoryHandle) {
    await set('projectHandle', handle)
  },

  async getHandle() {
    return await get<FileSystemDirectoryHandle>('projectHandle')
  },

  async verifyPermission(handle: FileSystemDirectoryHandle, mode = 'readwrite' as const) {
    if ((await handle.queryPermission({ mode })) === 'granted') {
      return true
    }
    if ((await handle.requestPermission({ mode })) === 'granted') {
      return true
    }
    return false
  }
}
