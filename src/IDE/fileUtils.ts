import type { FileRecord } from './db';
import type { FileNode } from './FileTree';

export function buildTree(files: FileRecord[]): FileNode[] {
  const nodeMap = new Map<string, FileNode>();
  const roots: FileNode[] = [];

  files.forEach((file) => {
    nodeMap.set(file.id, {
      id: file.id,
      name: file.name,
      parentId: file.parentId,
      type: file.type,
      children: file.type === 'folder' ? [] : undefined
    });
  });

  files.forEach((file) => {
    const node = nodeMap.get(file.id)!;
    if (file.parentId) {
      const parent = nodeMap.get(file.parentId);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function findFileNodeById(
  nodes: FileNode[],
  id: string
): FileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function getFilePath(
  nodes: FileNode[],
  targetId: string
): string | null {
  const findPath = (
    currentNodes: FileNode[],
    currentPath: string
  ): string | null => {
    for (const node of currentNodes) {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      if (node.id === targetId) return nodePath;
      if (node.children) {
        const found = findPath(node.children, nodePath);
        if (found) return found;
      }
    }
    return null;
  };
  return findPath(nodes, '');
}

export function findFileIdByPath(
  nodes: FileNode[],
  path: string
): string | null {
  const parts = path.split('/').filter(Boolean);
  let currentNodes = nodes;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const node = currentNodes.find((n) => n.name === part);

    if (!node) return null;

    if (i === parts.length - 1) {
      return node.id;
    } else {
      if (!node.children) return null;
      currentNodes = node.children;
    }
  }

  return null;
}
