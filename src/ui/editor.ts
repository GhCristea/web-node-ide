import type { Actor, Snapshot } from 'xstate'
import type { editorMachine } from '../core/machines/editor-machine'
import { registry } from '../core/services'
import type { ExecutorService, FileSystemService } from '../core/services'

export class EditorComponent {
  private actor: Actor<typeof editorMachine>
  private container: HTMLElement
  private textarea: HTMLTextAreaElement | null = null
  private statusArea: HTMLElement | null = null
  private errorPanel: HTMLElement | null = null
  private subscription: { unsubscribe: () => void } | null = null
  private executor: ExecutorService
  private filesystem: FileSystemService
  private currentPath: string | null = null

  constructor(actor: Actor<typeof editorMachine>, container: HTMLElement) {
    this.actor = actor
    this.container = container
    this.executor = registry.get('executor')
    this.filesystem = registry.get('filesystem')
    this.render()
    this.attachListeners()
    this.subscribeToState()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="editor">
        <header class="editor-header">
          <h1 id="file-path">Untitled</h1>
          <div class="status" id="status"></div>
        </header>

        <div class="editor-controls">
          <button id="btn-save" class="btn btn-primary">💾 Save</button>
          <button id="btn-run" class="btn btn-primary">▶ Run</button>
        </div>

        <textarea id="code-editor" class="code-editor" placeholder="Select a file to edit..."></textarea>

        <div id="error-panel" class="error-panel hidden">
          <p id="error-message" class="error-message"></p>
          <button id="btn-dismiss" class="btn btn-small">✕</button>
        </div>
      </div>
    `

    this.textarea = this.container.querySelector('#code-editor') as HTMLTextAreaElement
    this.statusArea = this.container.querySelector('#status') as HTMLElement
    this.errorPanel = this.container.querySelector('#error-panel') as HTMLElement
  }

  private attachListeners(): void {
    const btnSave = this.container.querySelector('#btn-save') as HTMLButtonElement
    const btnRun = this.container.querySelector('#btn-run') as HTMLButtonElement
    const btnDismiss = this.container.querySelector('#btn-dismiss') as HTMLButtonElement

    btnSave.addEventListener('click', () => {
      this.save()
    })

    btnRun.addEventListener('click', () => {
      this.execute()
    })

    btnDismiss.addEventListener('click', () => {
      this.hideError()
    })

    this.textarea?.addEventListener('input', e => {
      const content = (e.target as HTMLTextAreaElement).value
      this.actor.send({ type: 'EDIT', content })
    })
  }

  private async save(): Promise<void> {
    if (!this.currentPath) {
      this.showError('No file selected')
      return
    }

    try {
      const content = this.textarea?.value || ''
      await this.filesystem.writeFile(this.currentPath, content, { encoding: 'utf-8' })
      this.actor.send({ type: 'SAVE', path: this.currentPath, content })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save'
      this.showError(message)
    }
  }

  private async execute(): Promise<void> {
    if (!this.textarea?.value) {
      this.showError('No code to execute')
      return
    }

    try {
      const code = this.textarea.value
      const result = await this.executor.execute(code, { timeout: 5000 })

      this.actor.send({ type: 'EXECUTE', result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed'
      this.showError(message)
      this.actor.send({ type: 'ERROR', error: message })
    }
  }

  private subscribeToState(): void {
    this.unsubscribe = this.actor.subscribe(snapshot => {
      this.updateUI(snapshot)
    })
  }

  private async updateUI(snapshot: Snapshot<typeof editorMachine>): Promise<void> {
    const context = snapshot.context

    const pathEl = this.container.querySelector('#file-path') as HTMLElement
    if (context.currentPath) {
      this.currentPath = context.currentPath
      pathEl.textContent = context.currentPath.split('/').pop() || context.currentPath
    }

    if (this.textarea && this.textarea.value !== context.content) {
      this.textarea.value = context.content
    }

    const btnSave = this.container.querySelector('#btn-save') as HTMLButtonElement
    const btnRun = this.container.querySelector('#btn-run') as HTMLButtonElement

    const isDirty = context.content !== context.lastSaved
    btnSave.disabled = !isDirty || snapshot.matches('saving')
    btnRun.disabled = !context.currentPath || snapshot.matches('executing')
    this.textarea!.disabled = !context.currentPath

    this.updateStatus({
      saving: snapshot.matches('saving'),
      executing: snapshot.matches('executing'),
      error: context.error !== null,
      dirty: isDirty
    })

    if (context.error) {
      this.showError(context.error)
    } else {
      this.hideError()
    }
  }

  private updateStatus(status: { saving: boolean; executing: boolean; error: boolean; dirty: boolean }): void {
    const badges: string[] = []

    if (status.saving) badges.push('<span class="status-badge saving">Saving...</span>')
    if (status.executing) badges.push('<span class="status-badge executing">Running...</span>')
    if (status.error) badges.push('<span class="status-badge error">Error</span>')
    if (status.dirty) badges.push('<span class="status-badge dirty">Modified</span>')

    this.statusArea!.innerHTML = badges.join('')
  }

  private showError(message: string): void {
    if (!this.errorPanel) return
    this.errorPanel.classList.remove('hidden')
    const errorMsg = this.container.querySelector('#error-message') as HTMLElement
    errorMsg.textContent = message
  }

  private hideError(): void {
    if (!this.errorPanel) return
    this.errorPanel.classList.add('hidden')
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    this.executor.terminate()
  }
}
