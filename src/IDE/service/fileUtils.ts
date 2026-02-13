import type { FileSystemTree } from '@webcontainer/api'
import type { FileNode, FileRecord, FileMetadata } from '../../types/fileSystem'

export function buildTree(files: FileMetadata[]): FileNode[] {
  const nodeMap = new Map<string, FileNode>()
  const roots: FileNode[] = []

  files.forEach(file => {
    nodeMap.set(file.id, {
      id: file.id,
      name: file.name,
      parentId: file.parentId,
      type: file.type,
      children: file.type === 'folder' ? [] : undefined
    })
  })

  files.forEach(file => {
    const node = nodeMap.get(file.id)!
    if (file.parentId) {
      const parent = nodeMap.get(file.parentId)
      if (parent && parent.children) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

export function generatePaths(files: FileMetadata[]): Map<string, string> {
  const fileMap = new Map<string, FileMetadata>(files.map(f => [f.id, f]))
  const idToPath = new Map<string, string>()

  files.forEach(file => {
    if (file.type === 'folder') return

    let current: FileMetadata | undefined = file
    const pathParts: string[] = []

    while (current) {
      pathParts.unshift(current.name)
      if (current.parentId) {
        current = fileMap.get(current.parentId)
      } else {
        current = undefined
      }
    }

    if (pathParts.length > 0) {
      idToPath.set(file.id, pathParts.join('/'))
    }
  })

  return idToPath
}

export function generateFilePaths(files: FileRecord[]): Record<string, string> {
  const fileMap = new Map<string, FileRecord>(files.map(f => [f.id, f]))
  const paths: Record<string, string> = {}

  files.forEach(file => {
    if (file.type === 'folder') return

    let current: FileRecord | undefined = file
    const pathParts: string[] = []

    while (current) {
      pathParts.unshift(current.name)
      if (current.parentId) {
        current = fileMap.get(current.parentId)
      } else {
        current = undefined
      }
    }

    if (pathParts.length > 0) {
      paths[pathParts.join('/')] = file.content || ''
    }
  })

  return paths
}

export const isDir = (file: FileSystemTree[string]) => 'directory' in file

export function buildWebContainerTree(filesMap: Record<string, string>) {
  const tree: FileSystemTree = {}
  Object.entries(filesMap).forEach(([filePath, content]) => {
    const pathParts = filePath.split('/')
    let subtree = tree

    for (let index = 0; index < pathParts.length; index++) {
      const pathPart = pathParts[index]
      if (!pathPart) continue

      let node = subtree[pathPart]

      if (!node) {
        if (index !== pathParts.length - 1) {
          subtree[pathPart] = { directory: {} }
        } else {
          subtree[pathPart] = { file: { contents: content } } as const
        }
        node = subtree[pathPart]
      }

      if (node && isDir(node)) {
        subtree = node.directory
      }
    }
  })
  return tree
}
