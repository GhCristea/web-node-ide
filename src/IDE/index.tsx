import '@xterm/xterm/css/xterm.css';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { Play, Save } from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import { TerminalComponent } from './TerminalComponent';
import { FileTree } from './FileTree';
import { useCallback, useEffect } from 'react';

import { useToast } from '../toasts/useToast';
import { useIDE } from './useIDE';

export function IDE() {
  const {
    files,
    selectedFileId,
    selectFile,
    fileContent,
    updateFileContent,
    saveFile,
    createFile,
    run,
    reset,
    terminalRef,
    isRunning,
    isReady
  } = useIDE();

  const { showToast } = useToast();

  const handleSave = useCallback(async () => {
    await saveFile();
    showToast('File saved', 'success');
  }, [saveFile, showToast]);

  const handleCreate = async (type: 'file' | 'folder') => {
    const name = prompt(`Enter ${type} name:`);
    if (name) {
      await createFile(name, type);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="ide-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚡ Web IDE {isReady ? '(Ready)' : '(Loading...)'}</span>
          <button onClick={run} disabled={isRunning || !selectedFileId}>
            <Play size={14} /> Run
          </button>
          <button onClick={handleSave} disabled={!selectedFileId}>
            <Save size={14} /> Save
          </button>
          <button onClick={() => handleCreate('file')}>+ File</button>
          <button onClick={() => handleCreate('folder')}>+ Folder</button>
          <button onClick={reset} style={{ marginLeft: '10px', color: 'red' }}>
            Reset
          </button>
        </div>
      </header>

      <Group orientation="horizontal">
        <Panel defaultSize={200}>
          <FileTree
            nodes={files}
            onFileSelect={selectFile}
            selectedFileId={selectedFileId}
          />
        </Panel>

        <Separator className="resize-handle vertical" />

        <Panel>
          <Group orientation="vertical">
            <Panel defaultSize={70} minSize={30}>
              {selectedFileId ?
                <Editor
                  height="100%"
                  language="javascript"
                  theme="vs-dark"
                  value={fileContent}
                  onChange={(value) => updateFileContent(value || '')}
                />
              : <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666'
                  }}
                >
                  Select a file to edit
                </div>
              }
            </Panel>

            <Separator className="resize-handle horizontal" />

            <Panel defaultSize={20}>
              <TerminalComponent ref={terminalRef} />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
