/**
 * Editor UI component - Pure vanilla JavaScript.
 * Syncs with editor state machine via subscription.
 */

import type { Actor, Snapshot } from 'xstate';
import type { editorMachine } from '../core/machines/editor-machine';
import { registry } from '../core/services';
import type { NotificationService } from '../core/services';

export class EditorComponent {
  private actor: Actor<typeof editorMachine>;
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement | null = null;
  private statusArea: HTMLElement | null = null;
  private errorPanel: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(actor: Actor<typeof editorMachine>, container: HTMLElement) {
    this.actor = actor;
    this.container = container;
    this.render();
    this.attachListeners();
    this.subscribeToState();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="editor">
        <header class="editor-header">
          <h1>web-node-ide</h1>
          <div class="status" id="status"></div>
        </header>
        
        <div class="editor-controls">
          <button id="btn-open" class="btn btn-primary">📁 Open</button>
          <button id="btn-save" class="btn btn-primary">💾 Save</button>
          <button id="btn-run" class="btn btn-primary">▶ Run</button>
        </div>
        
        <textarea id="code-editor" class="code-editor" placeholder="Write your code here..."></textarea>
        
        <div id="error-panel" class="error-panel hidden">
          <p id="error-message" class="error-message"></p>
          <button id="btn-dismiss" class="btn btn-small">Dismiss</button>
        </div>
      </div>
    `;

    this.textarea = this.container.querySelector('#code-editor') as HTMLTextAreaElement;
    this.statusArea = this.container.querySelector('#status') as HTMLElement;
    this.errorPanel = this.container.querySelector('#error-panel') as HTMLElement;
  }

  private attachListeners(): void {
    const btnOpen = this.container.querySelector('#btn-open') as HTMLButtonElement;
    const btnSave = this.container.querySelector('#btn-save') as HTMLButtonElement;
    const btnRun = this.container.querySelector('#btn-run') as HTMLButtonElement;
    const btnDismiss = this.container.querySelector('#btn-dismiss') as HTMLButtonElement;

    btnOpen.addEventListener('click', () => {
      this.actor.send({ type: 'OPEN', path: 'main.js' });
    });

    btnSave.addEventListener('click', () => {
      this.actor.send({ type: 'SAVE' });
    });

    btnRun.addEventListener('click', () => {
      this.actor.send({ type: 'RUN' });
    });

    btnDismiss.addEventListener('click', () => {
      this.actor.send({ type: 'RESET_ERROR' });
    });

    this.textarea?.addEventListener('input', (e) => {
      const content = (e.target as HTMLTextAreaElement).value;
      this.actor.send({ type: 'MODIFY', content });
    });
  }

  private subscribeToState(): void {
    this.unsubscribe = this.actor.subscribe((snapshot) => {
      this.updateUI(snapshot);
    });
  }

  private updateUI(snapshot: Snapshot<typeof editorMachine>): void {
    const context = snapshot.context;
    const state = snapshot.value;

    // Update textarea
    if (this.textarea && this.textarea.value !== context.content) {
      this.textarea.value = context.content;
    }

    // Update disabled states
    const btnOpen = this.container.querySelector('#btn-open') as HTMLButtonElement;
    const btnSave = this.container.querySelector('#btn-save') as HTMLButtonElement;
    const btnRun = this.container.querySelector('#btn-run') as HTMLButtonElement;

    btnOpen.disabled =
      typeof state === 'object' ? !state.idle && !state.editing && !state.error : false;
    btnSave.disabled = !context.isDirty;
    btnRun.disabled = typeof state === 'object' ? !state.editing : false;

    this.textarea!.disabled = typeof state === 'object' ? !state.editing : false;

    // Update status badges
    this.updateStatus(
      typeof state === 'object'
        ? {
            loading: state.loading === true,
            saving: state.saving === true,
            executing: state.executing === true,
            error: state.error === true,
            dirty: context.isDirty
          }
        : { loading: false, saving: false, executing: false, error: false, dirty: false }
    );

    // Update error panel
    if (typeof state === 'object' && state.error === true) {
      this.showError(context.error || 'Unknown error');
    } else {
      this.hideError();
    }
  }

  private updateStatus(status: {
    loading: boolean;
    saving: boolean;
    executing: boolean;
    error: boolean;
    dirty: boolean;
  }): void {
    const badges: string[] = [];

    if (status.loading) badges.push('<span class="status-badge loading">Loading...</span>');
    if (status.saving) badges.push('<span class="status-badge saving">Saving...</span>');
    if (status.executing) badges.push('<span class="status-badge executing">Running...</span>');
    if (status.error) badges.push('<span class="status-badge error">Error</span>');
    if (status.dirty) badges.push('<span class="status-badge dirty">Modified</span>');

    this.statusArea!.innerHTML = badges.join('');
  }

  private showError(message: string): void {
    if (!this.errorPanel) return;
    this.errorPanel.classList.remove('hidden');
    const errorMsg = this.container.querySelector('#error-message') as HTMLElement;
    errorMsg.textContent = message;
  }

  private hideError(): void {
    if (!this.errorPanel) return;
    this.errorPanel.classList.add('hidden');
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
