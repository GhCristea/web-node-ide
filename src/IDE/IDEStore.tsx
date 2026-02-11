import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  useRef
} from 'react';
import {
  getFilesFromDb,
  createFile as dbCreateFile,
  saveFileContent as dbSaveFileContent,
  renameFile as dbRenameFile,
  moveFile as dbMoveFile,
  deleteFile as dbDeleteFile,
  initDb,
  resetFileSystem as dbResetFileSystem,
  generateFilePaths,
  getFileContent
} from './db';
import type { TerminalHandle } from './TerminalComponent';
import {
  findFileNodeById,
  getFilePath,
  buildTree,
  findFileIdByPath
} from './fileUtils';
import type { FileNode } from './FileTree';
import { useWebContainer } from './useWebContainer';

import { IDEContext } from './IDEContext';

export function IDEProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isDbReady, setIsDbReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const terminalRef = useRef<TerminalHandle>(null);

  const {
    isReady: isWcReady,
    mount,
    writeFile,
    webContainer
  } = useWebContainer();

  useEffect(() => {
    initDb()
      .then(async () => {
        setIsDbReady(true);
        await fetchFiles();
      })
      .catch((err: unknown) => setError(`DB Init Failed: ${err}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const allFiles = await getFilesFromDb();
      const tree = buildTree(allFiles);
      setFiles(tree);

      // Handle initial URL navigation
      const params = new URLSearchParams(window.location.search);
      const initialPath = params.get('file');
      if (initialPath) {
        const fileId = findFileIdByPath(tree, initialPath);
        if (fileId) {
          setSelectedFileId(fileId);
        }
      }

      if (isWcReady) {
        await mount(generateFilePaths(allFiles));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [isWcReady, mount]);

  useEffect(() => {
    if (isWcReady && isDbReady) {
      fetchFiles().then(() => {
        terminalRef.current?.write(
          '\x1b[32m✓ Node.js Environment Ready\x1b[0m\r\n'
        );
      });
    }
  }, [isWcReady, isDbReady, fetchFiles]);

  useEffect(() => {
    if (!selectedFileId) {
      setFileContent('');
      return;
    }
    getFileContent(selectedFileId).then((content) => {
      setFileContent(content);
    });
  }, [selectedFileId]);

  const selectFile = (id: string | null) => {
    setSelectedFileId(id);
    if (id) {
      const path = getFilePath(files, id);
      if (path) {
        const url = new URL(window.location.href);
        url.searchParams.set('file', path);
        window.history.replaceState({}, '', url);
      }
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('file');
      window.history.replaceState({}, '', url);
    }
  };

  const updateFileContent = (content: string) => {
    setFileContent(content);
  };

  const saveFile = async () => {
    if (!selectedFileId) return;

    try {
      await dbSaveFileContent(selectedFileId, fileContent);

      if (isWcReady) {
        const path = getFilePath(files, selectedFileId);
        if (path) {
          await writeFile(path, fileContent);
          console.log(`Synced ${path}`);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to save file');
    }
  };

  const createFile = async (
    name: string,
    type: 'file' | 'folder',
    explicitParentId?: string | null
  ) => {
    try {
      let parentId: string | null = null;

      if (explicitParentId !== undefined) {
        parentId = explicitParentId;
      } else if (selectedFileId) {
        const selectedNode = findFileNodeById(files, selectedFileId);
        if (selectedNode) {
          parentId =
            selectedNode.type === 'folder' ?
              selectedNode.id
            : selectedNode.parentId;
        }
      }

      await dbCreateFile(name, parentId, type, type === 'file' ? '' : '');
      await fetchFiles();
    } catch {
      setError(`Failed to create ${type}`);
    }
  };

  const renameNode = async (id: string, newName: string) => {
    try {
      await dbRenameFile(id, newName);
      await fetchFiles();
    } catch (err) {
      console.error(err);
      setError('Failed to rename');
    }
  };

  const moveNode = async (id: string, newParentId: string | null) => {
    try {
      await dbMoveFile(id, newParentId);
      await fetchFiles();
    } catch (err) {
      console.error(err);
      setError('Failed to move');
    }
  };

  const deleteNode = async (id: string) => {
    try {
      await dbDeleteFile(id);
      if (selectedFileId === id) {
        selectFile(null);
      }
      await fetchFiles();
    } catch (err) {
      console.error(err);
      setError('Failed to delete');
    }
  };

  const run = async () => {
    if (!selectedFileId || !isWcReady || !webContainer) return;

    const path = getFilePath(files, selectedFileId);
    if (!path) return;

    setIsRunning(true);
    terminalRef.current?.write(
      `\r\n\x1b[1;36m➤ Executing ${path}...\x1b[0m\r\n`
    );

    try {
      const process = await webContainer.spawn('node', [path]);
      process.output.pipeTo(
        new WritableStream({
          write(data) {
            terminalRef.current?.write(data);
          }
        })
      );
      const exitCode = await process.exit;
      terminalRef.current?.write(
        `\r\n\x1b[1;33mProcess exited with code ${exitCode}\x1b[0m\r\n`
      );
    } catch (err) {
      terminalRef.current?.write(`\x1b[1;31mError: ${err}\x1b[0m\r\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const reset = async () => {
    if (confirm('Reset file system?')) {
      await dbResetFileSystem();
      window.location.reload();
    }
  };

  return (
    <IDEContext.Provider
      value={{
        files,
        selectedFileId,
        fileContent,
        isReady: isWcReady && isDbReady,
        isRunning,
        isLoading,
        error,
        // @ts-expect-error terminalRef is not null
        terminalRef,
        selectFile,
        updateFileContent,
        saveFile,
        createFile,
        renameNode,
        moveNode,
        deleteNode,
        run,
        reset
      }}
    >
      {children}
    </IDEContext.Provider>
  );
}

export { IDEContext };
