import { WebContainer } from '@webcontainer/api';
import { buildTree, buildWebContainerTree, generateFilePaths } from './fileUtils';
import type { IDEService, IDEDependencies, FileNode } from './types';
import type { FileRecord } from '../types/dbTypes';

export function createIDEService(deps: IDEDependencies): IDEService {
  let _filesCache: FileRecord[] = [];
  let _treeCache: FileNode[] = [];
  let _webContainer: WebContainer | null = null;
  let _isWcReady = false;

  const updateTree = () => {
    _treeCache = buildTree(_filesCache);
    return _treeCache;
  };

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

  const syncToWebContainer = async (id: string, content: string) => {
    if (!_isWcReady || !_webContainer) return;
    const path = getPathFromCache(id);
    if (path) {
      try {
        await _webContainer.fs.writeFile(path, content);
        deps.terminal.write(`Synced ${path}\r\n`);
      } catch (e) {
        console.error('WC Write Error:', e);
      }
    }
  };

  const mountAll = async () => {
    if (!_webContainer) return;
    const paths = generateFilePaths(_filesCache);
    await _webContainer.mount(buildWebContainerTree(paths));
  };

  return {
    async initialize() {
      await deps.db.initDb();
      WebContainer.boot()
        .then(async wc => {
          _webContainer = wc;
          _isWcReady = true;
          await mountAll();
          deps.terminal.write('\x1b[32m✓ Node.js Runtime Ready\x1b[0m\r\n');
          if (deps.onReady) deps.onReady();
        })
        .catch(err => {
          console.error('WebContainer Boot Failed:', err);
          deps.terminal.write(`\x1b[1;31mRuntime Error: ${err}\x1b[0m\r\n`);
        });
    },

    getFiles() {
      return _treeCache;
    },

    async loadFiles() {
      const allFiles = await deps.db.getFilesFromDb();
      _filesCache = allFiles;
      const tree = updateTree();

      if (_isWcReady) {
        await mountAll();
      }

      return tree;
    },

    async getFileContent(id: string) {
      return deps.db.getFileContent(id);
    },

    async saveFile(id: string, content: string) {
      await deps.db.saveFileContent(id, content);
      const cachedFile = _filesCache.find(f => f.id === id);

      if (cachedFile) {
        cachedFile.content = content;
      }

      await syncToWebContainer(id, content);
    },

    async createNode(
      name: string,
      type: 'file' | 'folder',
      selectedFileId: string | null,
      explicitParentId?: string | null
    ) {
      const parentId = resolveParentId(selectedFileId, explicitParentId);
      const id = await deps.db.createFile(name, parentId, type, type === 'file' ? '' : '');

      const newFile: FileRecord = {
        id,
        name,
        type,
        parentId,
        content: type === 'file' ? '' : null,
        updated_at: new Date().toISOString()
      };
      _filesCache.push(newFile);

      if (type === 'file') {
        await syncToWebContainer(id, '');
      } else {
        if (_isWcReady && _webContainer) {
          const path = getPathFromCache(id);
          if (path) await _webContainer.fs.mkdir(path, { recursive: true });
        }
      }

      return updateTree();
    },

    async deleteNode(id: string) {
      await deps.db.deleteFile(id);
      const toRemove = new Set<string>();
      const collect = (nodeId: string) => {
        toRemove.add(nodeId);
        _filesCache.filter(f => f.parentId === nodeId).forEach(child => collect(child.id));
      };
      collect(id);
      _filesCache = _filesCache.filter(f => !toRemove.has(f.id));

      return updateTree();
    },

    async renameNode(id: string, newName: string) {
      await deps.db.renameFile(id, newName);
      const file = _filesCache.find(f => f.id === id);
      if (file) {
        file.name = newName;
      }

      return updateTree();
    },

    async moveNode(id: string, newParentId: string | null) {
      await deps.db.moveFile(id, newParentId);
      const file = _filesCache.find(f => f.id === id);
      if (file) {
        file.parentId = newParentId;
      }

      return updateTree();
    },

    async resetFileSystem() {
      if (confirm('Reset file system?')) {
        await deps.db.resetFileSystem();
        window.location.reload();
      }
    },

    async runFile(fileId: string) {
      if (!_isWcReady || !_webContainer) {
        deps.terminal.write('\r\n\x1b[1;33mRuntime not ready yet...\x1b[0m\r\n');
        return;
      }

      const path = getPathFromCache(fileId);
      if (!path) return;

      deps.terminal.write(`\r\n\x1b[1;36m➤ Executing ${path}...\x1b[0m\r\n`);

      try {
        const process = await _webContainer.spawn('node', [path]);
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              deps.terminal.write(data);
            }
          })
        );
        const exitCode = await process.exit;
        deps.terminal.write(`\r\n\x1b[1;33mProcess exited with code ${exitCode}\x1b[0m\r\n`);
      } catch (err) {
        deps.terminal.write(`\x1b[1;31mError: ${err}\x1b[0m\r\n`);
      }
    }
  };
}
