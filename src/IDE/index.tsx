import { onMount, onCleanup, Show } from 'solid-js'
import { PanelGroup, Panel, ResizeHandle } from 'solid-resizable-panels'
import { Play, Save } from 'lucide-solid'
import { MonacoEditor } from 'solid-monaco'
import { TerminalComponent } from './TerminalComponent'
import { showToast } from '../toasts/toastStore'
import { useIDEStore } from './IDEStore'

import 'solid-resizable-panels/styles.css'
import { FileTree } from './FileTree'

type MonacoOptions = Pick<
  Required<Pick<Parameters<typeof MonacoEditor>[0], 'options'>>['options'],
  'fontFamily' | 'fontWeight' | 'fontSize' | 'fontVariations' | 'fontLigatures' | 'theme'
>

export function IDE() {
  const ide = useIDEStore()

  const options: MonacoOptions = {
    fontFamily: 'Fira Code',
    fontWeight: 'normal',
    fontSize: 14,
    fontVariations: 'normal',
    fontLigatures: true,
    theme: 'vs-dark'
  }

  const handleSave = async () => {
    await ide().saveFile()
    showToast('File saved', 'success')
  }

  const handleCreate = async (type: 'file' | 'folder') => {
    const name = prompt(`Enter ${type} name:`)
    if (name) {
      await ide().createFile(name, type, null)
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

    ide().initialize()
  })

  return (
    <div class="ide-container">
      <header class="header">
        <span>⚡ Web IDE {ide().isDbReady ? '(Ready)' : '(Loading...)'}</span>
        <button
          onClick={async () => {
            await ide().saveFile()
            ide().run()
          }}
          disabled={ide().isRunning || !ide().selectedFileId}
        >
          <Play size={14} /> Run
        </button>
        <button onClick={handleSave} disabled={!ide().selectedFileId}>
          <Save size={14} /> Save
        </button>
        <button onClick={() => handleCreate('file')}>+ File</button>
        <button onClick={() => handleCreate('folder')}>+ Folder</button>
        <button onClick={async () => await ide().mountFromLocal()} disabled={!ide().isWcReady}>
          📂 Open
        </button>
        <button onClick={() => ide().reset()} style={{ 'margin-left': '10px', color: 'red' }}>
          Reset
        </button>
      </header>

      <PanelGroup direction="column" class="full">
        <Panel id="top-section" class="flex">
          <PanelGroup direction="row" class="grow-1">
            <Panel id="file-tree" initialSize={25} collapsible>
              <FileTree
                nodes={ide().files}
                onFileSelect={ide().selectFile}
                selectedFileId={ide().selectedFileId}
              />
            </Panel>

            <ResizeHandle />

            <Panel id="editor">
              <Show
                when={ide().selectedFileId}
                fallback={<div class="flex flex-center full">Select a file to edit</div>}
              >
                <MonacoEditor
                  height="100%"
                  width="100%"
                  language="javascript"
                  options={options}
                  value={ide().fileContent}
                  onChange={v => ide().updateFileContent(v)}
                />
              </Show>
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle />

        <Panel id="terminal-panel" initialSize={25} collapsible>
          <TerminalComponent ref={ide().setTerminal} />
        </Panel>
      </PanelGroup>
    </div>
  )
}
