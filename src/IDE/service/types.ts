import type { FileNode } from '../FileTree';

export interface FileRecord {
  id: string;
  name: string;
  parentId: string | null;
  type: 'file' | 'folder';
  content: string | null;
  updated_at: string;
}

export interface IDEService {
  // Lifecycle
  initialize(): Promise<void>;
  
  // File Operations
  loadFiles(isWcReady: boolean, mount: (paths: Record<string, string>) => Promise<void>): Promise<FileNode[]>;
  getFileContent(id: string): Promise<string>;
  saveFile(id: string, content: string, isWcReady: boolean, writeFile: (path: string, content: string) => Promise<void>, files: FileNode[]): Promise<void>;
  createNode(name: string, type: 'file' | 'folder', parentId: string | null): Promise<void>;
  deleteNode(id: string): Promise<void>;
  renameNode(id: string, newName: string): Promise<void>;
  moveNode(id: string, newParentId: string | null): Promise<void>;
  resetFileSystem(): Promise<void>;

  // Execution
  runFile(fileId: string, isWcReady: boolean, webContainer: any, files: FileNode[]): Promise<void>;
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
    initDb: () => Promise<any>;
  };
  terminal: {
    write: (data: string) => void;
  };
}
