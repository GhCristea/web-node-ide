import type { FileRecord } from '../db'
import type { FileNode } from '../FileTree'

export function buildTree(files: FileRecord[]): FileNode[] {
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
