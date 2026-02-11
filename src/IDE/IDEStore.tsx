import { useEffect, useState, type ReactNode, useRef, useMemo } from 'react';
import type { TerminalHandle } from './TerminalComponent';
import type { FileNode } from './FileTree';
import { createIDEService } from './service/ideService';
import { IDEContext } from './IDEContext';
import * as db from './db';

export function IDEProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const terminalRef = useRef<TerminalHandle>(null);

  // 1. Create Service (Direct DB Dependency)
  const service = useMemo(
    () =>
      createIDEService({
        db, // Injected directly, no worker wrapper needed
        terminal: { write: (data: string) => terminalRef.current?.write(data) },
        onReady: () => setIsReady(true)
      }),
    []
  );

  // 2. Init
  useEffect(() => {
    setIsLoading(true);
    service.initialize()
      .then(() => service.loadFiles())
      .then((tree) => {
        setFiles(tree);
      })
      .catch((err) => setError(`Init Failed: ${err}`))
      .finally(() => setIsLoading(false));
  }, [service]);

  // 3. File Selection
  useEffect(() => {
    if (!selectedFileId) {
      setFileContent('');
      return;
    }
    service.getFileContent(selectedFileId).then(setFileContent);
  }, [service, selectedFileId]);

  // --- Actions ---

  const selectFile = (id: string | null) => setSelectedFileId(id);
  const updateFileContent = (content: string) => setFileContent(content);

  const saveFile = async () => {
    if (!selectedFileId) return;
    try {
      await service.saveFile(selectedFileId, fileContent);
    } catch {
      setError('Failed to save file');
    }
  };

  const createFile = async (
    name: string,
    type: 'file' | 'folder',
    explicitParentId?: string | null
  ) => {
    try {
      const newTree = await service.createNode(name, type, selectedFileId, explicitParentId);
      setFiles(newTree);
    } catch {
      setError(`Failed to create ${type}`);
    }
  };

  const renameNode = async (id: string, newName: string) => {
    try {
      const newTree = await service.renameNode(id, newName);
      setFiles(newTree);
    } catch {
      setError('Failed to rename');
    }
  };

  const moveNode = async (id: string, newParentId: string | null) => {
    try {
      const newTree = await service.moveNode(id, newParentId);
      setFiles(newTree);
    } catch {
      setError('Failed to move');
    }
  };

  const deleteNode = async (id: string) => {
    try {
      const newTree = await service.deleteNode(id);
      setFiles(newTree);
      if (selectedFileId === id) selectFile(null);
    } catch {
      setError('Failed to delete');
    }
  };

  const run = async () => {
    if (!selectedFileId) return;
    setIsRunning(true);
    try {
      await service.runFile(selectedFileId);
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
        isReady,
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
