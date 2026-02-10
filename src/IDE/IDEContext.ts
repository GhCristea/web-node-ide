import { createContext, type RefObject } from 'react';
import type { TerminalHandle } from './TerminalComponent';
import type { FileNode } from './FileTree';

export interface IDEContextType {
  files: FileNode[];
  selectedFileId: string | null;
  fileContent: string;
  isReady: boolean;
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  terminalRef: RefObject<TerminalHandle | null>;
  selectFile: (id: string | null) => void;
  updateFileContent: (content: string) => void;
  saveFile: () => Promise<void>;
  createFile: (name: string, type: 'file' | 'folder') => Promise<void>;
  run: () => Promise<void>;
  reset: () => Promise<void>;
}

export const IDEContext = createContext<IDEContextType | null>(null);
