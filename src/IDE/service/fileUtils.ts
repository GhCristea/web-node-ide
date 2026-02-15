import type { FileSystemTree } from '@webcontainer/api'
import type { FileNode, FileMetadata, Id } from '../types'

export function buildTree(files: FileMetadata[]) {
  const nodeMap = new Map<Id, FileNode>()
  const roots: FileNode[] = []

  files.forEach(file => {
    nodeMap.set(file.id, {
      id: file.id,
      name: file.name,
      parentId: file.parentId,
      type: file.type,
      children: file.type === 'directory' ? [] : undefined
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

export function generatePaths(files: FileMetadata[]) {
  const fileMap = new Map<Id, FileMetadata>(files.map(f => [f.id, f]))
  const idToPath = new Map<Id, string>()

  files.forEach(file => {
    if (file.type === 'directory') return

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

      if (node && 'directory' in node) {
        subtree = node.directory
      }
    }
  })
  return tree
}

export function isValidFileName(name: string): boolean {
  if (!name || name.trim() === '') return false
  if (name.includes('/') || name.includes('\\')) return false
  if (name === '.' || name === '..') return false
  return true
}
