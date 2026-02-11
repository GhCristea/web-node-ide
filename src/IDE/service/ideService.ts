import { buildTree, generateFilePaths } from '../fileUtils';
import type { IDEService, IDEDependencies, FileRecord } from './types';
import type { FileNode } from '../FileTree';

export function createIDEService(deps: IDEDependencies): IDEService {
  let _filesCache: FileRecord[] = [];

  const getPathFromCache = (fileId: string): string | null => {
    const file = _filesCache.find(f => f.id === fileId);
    if (!file) return null;

    const parts = [file.name];
    let current = file;
    while (current.parentId) {
      const parent = _filesCache.find(p => p.id === current.parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.join('/');
  };

  const resolveParentId = (selectedFileId: string | null, explicitParentId?: string | null): string | null => {
    if (explicitParentId !== undefined) {
      return explicitParentId;
    } 
    
    if (selectedFileId) {
      const selectedNode = _filesCache.find(f => f.id === selectedFileId);
      if (selectedNode) {
        return selectedNode.type === 'folder' ? selectedNode.id : selectedNode.parentId;
      }
    }
    return null;
  };

  return {
    async initialize() {
      await deps.db.initDb();
    },

    async loadFiles(isWcReady: boolean, mount: (paths: Record<string, string>) => Promise<void>) {
      const allFiles = await deps.db.getFilesFromDb();
      _filesCache = allFiles;
      
      const tree = buildTree(allFiles);

      if (isWcReady) {
        await mount(generateFilePaths(allFiles));
      }

      return tree;
    },

    async getFileContent(id: string) {
      return deps.db.getFileContent(id);
    },

    async saveFile(id: string, content: string, isWcReady: boolean, writeFile: (path: string, content: string) => Promise<void>) {
      await deps.db.saveFileContent(id, content);

      // Update cache content locally to keep it consistent without re-fetching
      const cachedFile = _filesCache.find(f => f.id === id);
      if (cachedFile) {
        cachedFile.content = content;
      }

      if (isWcReady) {
        const path = getPathFromCache(id);
        if (path) {
          await writeFile(path, content);
          deps.terminal.write(`Synced ${path}\r\n`);
        }
      }
    },

    async createNode(name: string, type: 'file' | 'folder', selectedFileId: string | null, explicitParentId?: string | null) {
      const parentId = resolveParentId(selectedFileId, explicitParentId);
      await deps.db.createFile(name, parentId, type, type === 'file' ? '' : '');
    },

    async deleteNode(id: string) {
      await deps.db.deleteFile(id);
    },

    async renameNode(id: string, newName: string) {
      await deps.db.renameFile(id, newName);
    },

    async moveNode(id: string, newParentId: string | null) {
      await deps.db.moveFile(id, newParentId);
    },

    async resetFileSystem() {
      if (confirm('Reset file system?')) {
        await deps.db.resetFileSystem();
        window.location.reload();
      }
    },

    async runFile(fileId: string, isWcReady: boolean, webContainer: any) {
      if (!isWcReady || !webContainer) return;

      const path = getPathFromCache(fileId);
      if (!path) return;

      deps.terminal.write(
        `\r\n\x1b[1;36m➤ Executing ${path}...\x1b[0m\r\n`
      );

      try {
        const process = await webContainer.spawn('node', [path]);
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              deps.terminal.write(data);
            }
          })
        );
        const exitCode = await process.exit;
        deps.terminal.write(
          `\r\n\x1b[1;33mProcess exited with code ${exitCode}\x1b[0m\r\n`
        );
      } catch (err) {
        deps.terminal.write(`\x1b[1;31mError: ${err}\x1b[0m\r\n`);
      }
    }
  };
}
