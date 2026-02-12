/**
 * FileTree UI component - displays directory structure.
 * Pure vanilla JavaScript, syncs with FileService.
 */

import { registry } from '../core/services';
import type { FileService } from '../core/services';

export class FileTreeComponent {
  private container: HTMLElement;
  private fileService: FileService;
  private expandedDirs = new Set<string>();

  constructor(container: HTMLElement) {
    this.container = container;
    this.fileService = registry.get('file');
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="file-tree">
        <header class="file-tree-header">
          <h3>Files</h3>
        </header>
        <div id="file-tree-content" class="file-tree-content"></div>
      </div>
    `;
    this.loadDirectory('/');
  }

  private async loadDirectory(path: string): Promise<void> {
    try {
      const files = await this.fileService.listDirectory(path);
      const content = this.container.querySelector('#file-tree-content') as HTMLElement;

      if (files.length === 0) {
        content.innerHTML = '<p class="file-tree-empty">No files</p>';
        return;
      }

      const html = files
        .map((file) => {
          const isDir = file.endsWith('/');
          const name = file.split('/').filter(Boolean).pop() || file;
          const icon = isDir ? '📁' : '📄';
          const id = `file-${file.replace(/\//g, '-')}`;

          return `
            <div class="file-tree-item" data-path="${file}">
              ${isDir ? `<button class="file-tree-toggle" data-path="${file}">▶</button>` : '<span class="file-tree-spacer"></span>'}
              <span class="file-tree-icon">${icon}</span>
              <span class="file-tree-name" data-path="${file}">${this.escapeHtml(name)}</span>
            </div>
          `;
        })
        .join('');

      content.innerHTML = html;
      this.attachListeners();
    } catch (err) {
      const content = this.container.querySelector('#file-tree-content') as HTMLElement;
      content.innerHTML = `<p class="file-tree-error">Error loading files</p>`;
    }
  }

  private attachListeners(): void {
    // Attach click listeners to file names
    this.container.querySelectorAll('.file-tree-name').forEach((el) => {
      el.addEventListener('click', (e) => {
        const path = (e.target as HTMLElement).getAttribute('data-path');
        if (path) {
          this.onFileSelect(path);
        }
      });
    });

    // Attach toggle listeners
    this.container.querySelectorAll('.file-tree-toggle').forEach((el) => {
      el.addEventListener('click', (e) => {
        const path = (e.currentTarget as HTMLElement).getAttribute('data-path');
        if (path) {
          this.onToggleDir(path, el as HTMLElement);
        }
      });
    });
  }

  private onFileSelect(path: string): void {
    // Dispatch custom event that parent can listen to
    const event = new CustomEvent('file-select', { detail: { path } });
    this.container.dispatchEvent(event);
  }

  private onToggleDir(path: string, button: HTMLElement): void {
    if (this.expandedDirs.has(path)) {
      this.expandedDirs.delete(path);
      button.textContent = '▶';
    } else {
      this.expandedDirs.add(path);
      button.textContent = '▼';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refresh(): Promise<void> {
    await this.loadDirectory('/');
  }
}
