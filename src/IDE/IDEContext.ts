import { createContext } from 'react';
import type { FileNode } from './FileTree';
import type { TerminalHandle } from './TerminalComponent';

interface IDEContextType {
  files: FileNode[];
  selectedFileId: string | null;
  fileContent: string;
  isReady: boolean;
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  terminalRef: React.RefObject<TerminalHandle> | null;
  selectFile: (id: string | null) => void;
  updateFileContent: (content: string) => void;
  saveFile: () => Promise<void>;
  createFile: (name: string, type: 'file' | 'folder') => Promise<void>;
  renameNode: (id: string, newName: string) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  run: () => Promise<void>;
  reset: () => Promise<void>;
}

export const IDEContext = createContext<IDEContextType | null>(null);
