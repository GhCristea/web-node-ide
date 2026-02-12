/**
 * OutputPanel UI component - displays execution results and logs.
 * Pure vanilla JavaScript.
 */

import { registry } from '../core/services';
import type { NotificationService, LoggerService } from '../core/services';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class OutputPanelComponent {
  private container: HTMLElement;
  private loggerService: LoggerService;
  private outputArea: HTMLElement | null = null;
  private logs: Array<{ type: 'log' | 'error' | 'result'; message: string }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.loggerService = registry.get('logger');
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="output-panel">
        <header class="output-header">
          <h3>Output</h3>
          <button id="btn-clear" class="btn btn-small">Clear</button>
        </header>
        <div id="output-area" class="output-area"></div>
      </div>
    `;

    this.outputArea = this.container.querySelector('#output-area') as HTMLElement;
    const btnClear = this.container.querySelector('#btn-clear') as HTMLButtonElement;

    btnClear.addEventListener('click', () => this.clear());
  }

  addLog(type: 'log' | 'error' | 'result', message: string): void {
    this.logs.push({ type, message });
    this.renderLogs();
  }

  addExecutionResult(result: ExecutionResult): void {
    if (result.stdout) {
      this.addLog('result', `✓ stdout:\n${result.stdout}`);
    }
    if (result.stderr) {
      this.addLog('error', `✗ stderr:\n${result.stderr}`);
    }
    this.addLog('result', `Exit code: ${result.exitCode}`);
  }

  private renderLogs(): void {
    if (!this.outputArea) return;

    const html = this.logs
      .map((log) => {
        const className = `output-line output-${log.type}`;
        const escaped = this.escapeHtml(log.message);
        return `<div class="${className}">${escaped}</div>`;
      })
      .join('');

    this.outputArea.innerHTML = html;
    // Scroll to bottom
    this.outputArea.scrollTop = this.outputArea.scrollHeight;
  }

  clear(): void {
    this.logs = [];
    if (this.outputArea) {
      this.outputArea.innerHTML = '';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
