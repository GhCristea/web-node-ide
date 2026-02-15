import { onMount, onCleanup, Show } from 'solid-js'
import { PanelGroup, Panel, ResizeHandle } from 'solid-resizable-panels'
import { Play, Save } from 'lucide-solid'
import { MonacoEditor } from 'solid-monaco'
import { TerminalComponent } from './TerminalComponent'
import { showToast } from '../toasts/toastStore'
import {
  ideStore,
  initialize,
  saveFile,
  createFile,
  mountFromLocal,
  reset,
  run,
  selectFile,
  updateFileContent,
  setTerminal
} from './IDEStore'
import 'solid-resizable-panels/styles.css'
import { FileTree } from './FileTree'
import type { MonacoOptions, FsKind } from './types'

export function IDE() {
  const options: MonacoOptions = {
    fontFamily: 'Fira Code',
    fontWeight: 'normal',
    fontSize: 14,
    fontVariations: 'normal',
    fontLigatures: true,
    theme: 'vs-dark'
  }

  const handleSave = async () => {
    await saveFile()
    showToast('File saved', 'success')
  }

  const handleCreate = async (type: FsKind) => {
    const name = prompt(`Enter ${type} name:`)
    if (name) {
      await createFile(name, type, null)
    }
  }

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown))

    initialize()
  })

  return (
    <div class="ide-container">
      <header class="header">
        <span>⚡ Web IDE {ideStore.isDbReady ? '(Ready)' : '(Loading...)'}</span>
        <button
          onClick={async () => {
            await saveFile()
            run()
          }}
          disabled={ideStore.isRunning || !ideStore.selectedFileId}
        >
          <Play size={14} /> Run
        </button>
        <button onClick={handleSave} disabled={!ideStore.selectedFileId}>
          <Save size={14} /> Save
        </button>
        <button onClick={() => handleCreate('file')}>+ File</button>
        <button onClick={() => handleCreate('directory')}>+ Folder</button>
        <button onClick={async () => await mountFromLocal()} disabled={!ideStore.isWcReady}>
          📂 Open
        </button>
        <button onClick={() => reset()} style={{ 'margin-left': '10px', color: 'red' }}>
          Reset
        </button>
      </header>

      <PanelGroup direction="column" class="full">
        <Panel id="top-section" class="flex">
          <PanelGroup direction="row" class="grow-1">
            <Panel id="file-tree" initialSize={25} collapsible>
              <FileTree
                nodes={ideStore.files}
                onFileSelect={selectFile}
                selectedFileId={ideStore.selectedFileId}
              />
            </Panel>

            <ResizeHandle />

            <Panel id="editor">
              <Show
                when={ideStore.selectedFileId}
                fallback={<div class="flex flex-center full">Select a file to edit</div>}
              >
                <Show
                  when={ideStore.fileContent !== '<<ERROR_LOADING_FILE>>'}
                  fallback={
                    <div class="flex flex-center full column" style={{ color: '#ff6b6b' }}>
                      <div style={{ 'font-size': '24px', 'margin-bottom': '10px' }}>⚠️</div>
                      <div>Failed to load file content</div>
                      <div style={{ 'font-size': '12px', opacity: 0.7, 'margin-top': '5px' }}>
                        Check console for details
                      </div>
                    </div>
                  }
                >
                  <MonacoEditor
                    height="100%"
                    width="100%"
                    language="javascript"
                    options={options}
                    value={ideStore.fileContent}
                    onChange={v => updateFileContent(v)}
                  />
                </Show>
              </Show>
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle />

        <Panel id="terminal-panel" initialSize={25} collapsible>
          <TerminalComponent ref={setTerminal} />
        </Panel>
      </PanelGroup>
    </div>
  )
}
