import { useEffect, useState, useCallback, type ReactNode, useRef, useMemo } from 'react';
import * as db from './db';
import type { TerminalHandle } from './TerminalComponent';
import type { FileNode } from './FileTree';
import { useWebContainer } from './useWebContainer';
import { createIDEService } from './service/ideService';
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

  const { isReady: isWcReady, mount, writeFile, webContainer } = useWebContainer();

  const service = useMemo(() => {
    return createIDEService({
      db: db,
      terminal: { write: (data: string) => terminalRef.current?.write(data) }
    });
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const tree = await service.loadFiles(isWcReady, mount);
      setFiles(tree);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [service, isWcReady, mount]);

  useEffect(() => {
    db.initDb()
      .then(async () => {
        setIsDbReady(true);
        await service.initialize();
        await fetchFiles();
      })
      .catch((err: unknown) => setError(`DB Init Failed: ${err}`));
  }, [service, fetchFiles]);

  useEffect(() => {
    if (isWcReady && isDbReady) {
      fetchFiles().then(() => {
        terminalRef.current?.write('\x1b[32m✓ Node.js Environment Ready\x1b[0m\r\n');
      });
    }
  }, [isWcReady, isDbReady, fetchFiles]);

  useEffect(() => {
    if (!selectedFileId) {
      setFileContent('');
      return;
    }
    service.getFileContent(selectedFileId).then(content => {
      setFileContent(content);
    });
  }, [service, selectedFileId]);

  const selectFile = (id: string | null) => {
    setSelectedFileId(id);
  };

  const updateFileContent = (content: string) => {
    setFileContent(content);
  };

  const saveFile = async () => {
    if (!selectedFileId) return;

    try {
      await service.saveFile(selectedFileId, fileContent, isWcReady, writeFile);
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
      await service.createNode(name, type, selectedFileId, explicitParentId);
      await fetchFiles();
    } catch {
      setError(`Failed to create ${type}`);
    }
  };

  const renameNode = async (id: string, newName: string) => {
    try {
      await service.renameNode(id, newName);
      await fetchFiles();
    } catch (err) {
      console.error(err);
      setError('Failed to rename');
    }
  };

  const moveNode = async (id: string, newParentId: string | null) => {
    try {
      await service.moveNode(id, newParentId);
      await fetchFiles();
    } catch (err) {
      console.error(err);
      setError('Failed to move');
    }
  };

  const deleteNode = async (id: string) => {
    try {
      await service.deleteNode(id);
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

    setIsRunning(true);
    try {
      await service.runFile(selectedFileId, isWcReady, webContainer);
    } finally {
      setIsRunning(false);
    }
  };

  const reset = async () => {
    await service.resetFileSystem();
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
