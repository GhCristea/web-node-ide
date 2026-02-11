import type { FileRecord } from '../types/dbTypes';

export type { FileRecord };

export interface IDEService {
  // Lifecycle
  initialize(): Promise<void>;
  
  // State Access
  getFiles(): FileNode[];
  
  // File Operations
  loadFiles(): Promise<FileNode[]>;
  getFileContent(id: string): Promise<string>;
  
  saveFile(id: string, content: string): Promise<void>;
  
  createNode(
    name: string, 
    type: 'file' | 'folder', 
    selectedFileId: string | null,
    explicitParentId?: string | null
  ): Promise<FileNode[]>;
  
  deleteNode(id: string): Promise<FileNode[]>;
  renameNode(id: string, newName: string): Promise<FileNode[]>;
  moveNode(id: string, newParentId: string | null): Promise<FileNode[]>;
  resetFileSystem(): Promise<void>;

  // Execution
  runFile(fileId: string): Promise<void>;
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
  onReady?: () => void;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  parentId: string | null;
}
