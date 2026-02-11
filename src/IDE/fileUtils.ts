import type { FileRecord } from './types/dbTypes';
import type { FileNode } from './FileTree';

export function buildTree(files: FileRecord[]): FileNode[] {
  const map = new Map<string, FileNode>();
  const tree: FileNode[] = [];

  // 1. Create all nodes
  files.forEach((file) => {
    map.set(file.id, {
      id: file.id,
      name: file.name,
      type: file.type,
      parentId: file.parentId,
      children: file.type === 'folder' ? [] : undefined
    });
  });

  // 2. Build hierarchy
  files.forEach((file) => {
    const node = map.get(file.id);
    if (!node) return;

    if (file.parentId) {
      const parent = map.get(file.parentId);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  // 3. Sort nodes (folders first, then files, alphabetical)
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(tree);
  return tree;
}

export function generateFilePaths(files: FileRecord[]): Record<string, string> {
  const fileMap = new Map<string, FileRecord>(files.map((f) => [f.id, f]));
  const paths: Record<string, string> = {};

  files.forEach((file) => {
    if (file.type === 'folder') return;

    let current: FileRecord | undefined = file;
    const pathParts: string[] = [];

    while (current) {
      pathParts.unshift(current.name);
      if (current.parentId) {
        current = fileMap.get(current.parentId);
      } else {
        current = undefined;
      }
    }

    if (pathParts.length > 0) {
      paths[pathParts.join('/')] = file.content || '';
    }
  });

  return paths;
}

export function findFileNodeById(
  nodes: FileNode[],
  id: string
): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getFilePath(nodes: FileNode[], id: string): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.name;
    if (node.children) {
      const path = getFilePath(node.children, id);
      if (path) return `${node.name}/${path}`;
    }
  }
  return null;
}

export function findFileIdByPath(nodes: FileNode[], path: string): string | null {
  const parts = path.split('/');
  let currentNodes = nodes;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const foundNode = currentNodes.find((n) => n.name === part);

    if (!foundNode) return null;
    if (i === parts.length - 1) return foundNode.id;
    if (foundNode.type === 'file') return null;
    
    currentNodes = foundNode.children || [];
  }
  return null;
}
