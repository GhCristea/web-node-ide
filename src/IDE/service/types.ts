import type { FileNode } from '../FileTree';
import type { FileRecord } from '../types/dbTypes';
import type { WebContainer } from '@webcontainer/api';

export type { FileRecord };

export interface IDEService {
  // Lifecycle
  initialize(): Promise<void>;
  
  // File Operations
  loadFiles(isWcReady: boolean, mount: (paths: Record<string, string>) => Promise<void>): Promise<FileNode[]>;
  getFileContent(id: string): Promise<string>;
  
  saveFile(
    id: string, 
    content: string, 
    isWcReady: boolean, 
    writeFile: (path: string, content: string) => Promise<void>
  ): Promise<void>;

  createNode(
    name: string, 
    type: 'file' | 'folder', 
    selectedFileId: string | null,
    explicitParentId?: string | null
  ): Promise<void>;
  
  deleteNode(id: string): Promise<void>;
  renameNode(id: string, newName: string): Promise<void>;
  moveNode(id: string, newParentId: string | null): Promise<void>;
  resetFileSystem(): Promise<void>;

  // Execution
  runFile(
    fileId: string, 
    isWcReady: boolean, 
    webContainer: WebContainer
  ): Promise<void>;
}

export interface IDEDependencies {
  db: {
    getFilesFromDb: () => Promise<FileRecord[]>;
    getFileContent: (id: string) => Promise<string>;
    saveFileContent: (id: string, content: string) => Promise<void>;
    createFile: (name: string, parentId: string | null, type: 'file' | 'folder', content?: string) => Promise<string>;
    renameFile: (id: string, newName: string) => Promise<void>;
    moveFile: (id: string, newParentId: string | null) => Promise<void>;
    deleteFile: (id: string) => Promise<void>;
    resetFileSystem: () => Promise<void>;
    initDb: () => Promise<unknown>;
  };
  terminal: {
    write: (data: string) => void;
  };
}
