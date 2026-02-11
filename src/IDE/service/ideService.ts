import { WebContainer } from '@webcontainer/api';
import { buildTree, buildWebContainerTree, generateFilePaths } from '../fileUtils';
import type { IDEService, IDEDependencies, FileNode } from './types';
import type { FileRecord } from '../types/dbTypes';

/**
 * WebContainer is a singleton per page.
 * React.StrictMode intentionally mounts/unmounts components twice in dev, so we must boot once.
 */
let _sharedWebContainer: WebContainer | null = null;
let _sharedWebContainerPromise: Promise<WebContainer> | null = null;
let _sharedWebContainerAnnouncedReady = false;

function ensureWebContainerBootedOnce(): Promise<WebContainer> {
  if (_sharedWebContainer) return Promise.resolve(_sharedWebContainer);

  if (!_sharedWebContainerPromise) {
    _sharedWebContainerPromise = WebContainer.boot().then((wc) => {
      _sharedWebContainer = wc;
      return wc;
    });
  }

  return _sharedWebContainerPromise;
}

export function createIDEService(deps: IDEDependencies): IDEService {
  // Internal State
  let _filesCache: FileRecord[] = [];
  let _treeCache: FileNode[] = [];
  let _webContainer: WebContainer | null = null;
  let _isWcReady = false;
  let _initializeCalled = false;

  // --- Helpers ---

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

  // --- Service Implementation ---

  return {
    async initialize() {
      // Idempotent per-service instance
      if (_initializeCalled) return;
      _initializeCalled = true;

      // 1. Init DB (persistence truth)
      await deps.db.initDb();

      // 2. Boot WebContainer once (runtime consumer)
      ensureWebContainerBootedOnce()
        .then(async (wc) => {
          _webContainer = wc;
          _isWcReady = true;

          // Mount whatever files we currently have (may be empty; loadFiles() will mount again).
          await mountAll();

          if (!_sharedWebContainerAnnouncedReady) {
            deps.terminal.write('\x1b[32m✓ Node.js Runtime Ready\x1b[0m\r\n');
            _sharedWebContainerAnnouncedReady = true;
          }

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
      // Fetch from DB
      const allFiles = await deps.db.getFilesFromDb();
      _filesCache = allFiles;
      
      // Update Tree (React should show this immediately)
      const tree = updateTree();

      // Runtime is just a consumer: best-effort sync
      if (_isWcReady) {
        await mountAll();
      }

      return tree;
    },

    async getFileContent(id: string) {
      return deps.db.getFileContent(id);
    },

    async saveFile(id: string, content: string) {
      // 1. Persist
      await deps.db.saveFileContent(id, content);

      // 2. Update session cache
      const cachedFile = _filesCache.find(f => f.id === id);
      if (cachedFile) {
        cachedFile.content = content;
      }

      // 3. Sync runtime (best effort)
      await syncToWebContainer(id, content);
    },

    async createNode(
      name: string,
      type: 'file' | 'folder',
      selectedFileId: string | null,
      explicitParentId?: string | null
    ) {
      const parentId = resolveParentId(selectedFileId, explicitParentId);
      
      // 1. Persist
      const id = await deps.db.createFile(name, parentId, type, type === 'file' ? '' : '');

      // 2. Update session cache
      const newFile: FileRecord = {
        id,
        name,
        type,
        parentId,
        content: type === 'file' ? '' : null,
        updated_at: new Date().toISOString()
      };
      _filesCache.push(newFile);

      // 3. Sync runtime
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
      // 1. Persist
      await deps.db.deleteFile(id);

      // 2. Update session cache (recursive removal)
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
      // 1. Persist
      await deps.db.renameFile(id, newName);

      // 2. Update session cache
      const file = _filesCache.find(f => f.id === id);
      if (file) {
        file.name = newName;
      }

      return updateTree();
    },

    async moveNode(id: string, newParentId: string | null) {
      // 1. Persist
      await deps.db.moveFile(id, newParentId);

      // 2. Update session cache
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
