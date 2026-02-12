/**
 * FileTreeComponent - displays virtual file system tree.
 * Pure vanilla JavaScript.
 */

import type { FileSystemService } from '../core/services'
import type { Dirent } from '../core/services/filesystem'

export class FileTreeComponent {
  private container: HTMLElement
  private filesystem: FileSystemService
  private tree: Map<string, boolean> = new Map() // path -> expanded state

  constructor(container: HTMLElement, filesystem: FileSystemService) {
    this.container = container
    this.filesystem = filesystem
    this.render()
  }

  private async render(): Promise<void> {
    this.container.innerHTML = `
      <div class="file-tree">
        <header class="file-tree-header">
          <h3>Files</h3>
        </header>
        <div id="file-tree-content" class="file-tree-content"></div>
      </div>
    `

    const content = this.container.querySelector('#file-tree-content') as HTMLElement

    try {
      await this.renderDirectory('/', content, 0)
    } catch (error) {
      content.innerHTML = `<div class="file-tree-error">Error loading files</div>`
    }
  }

  private async renderDirectory(
    path: string,
    container: HTMLElement,
    depth: number
  ): Promise<void> {
    try {
      const entries = (await this.filesystem.readdir(path, {
        withFileTypes: true,
      })) as Dirent[]

      // Sort: directories first, then alphabetically
      const sorted = entries.sort((a, b) => {
        const aIsDir = a.isDirectory()
        const bIsDir = b.isDirectory()
        if (aIsDir !== bIsDir) return bIsDir ? 1 : -1
        return a.name.localeCompare(b.name)
      })

      sorted.forEach((entry) => {
        const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`
        this.renderEntry(entry, fullPath, container, depth)
      })
    } catch (error) {
      // Directory doesn't exist or is empty
    }
  }

  private renderEntry(
    entry: Dirent,
    fullPath: string,
    container: HTMLElement,
    depth: number
  ): void {
    const isDir = entry.isDirectory()
    const isExpanded = this.tree.get(fullPath) ?? false

    const item = document.createElement('div')
    item.className = 'file-tree-item'
    item.style.paddingLeft = `${depth * 1.5}rem`

    // Toggle button for directories
    if (isDir) {
      const toggle = document.createElement('button')
      toggle.className = 'file-tree-toggle'
      toggle.textContent = isExpanded ? '▼' : '▶'
      toggle.onclick = (e) => {
        e.stopPropagation()
        this.toggleDirectory(fullPath, isExpanded, container)
      }
      item.appendChild(toggle)
    } else {
      const spacer = document.createElement('div')
      spacer.className = 'file-tree-spacer'
      item.appendChild(spacer)
    }

    // Icon
    const icon = document.createElement('span')
    icon.className = 'file-tree-icon'
    icon.textContent = isDir ? '📁' : '📄'
    item.appendChild(icon)

    // Name
    const name = document.createElement('span')
    name.className = 'file-tree-name'
    name.textContent = entry.name
    item.appendChild(name)

    // Click to open file
    if (!isDir) {
      item.style.cursor = 'pointer'
      item.onclick = () => {
        this.dispatchFileSelect(fullPath)
      }
    }

    container.appendChild(item)

    // Render children if directory is expanded
    if (isDir && isExpanded) {
      this.renderDirectorySync(fullPath, container, depth + 1)
    }
  }

  private renderDirectorySync(path: string, container: HTMLElement, depth: number): void {
    // Async-safe version: schedule rendering
    this.renderDirectory(path, container, depth).catch((err) => {
      console.error(`Failed to render directory ${path}:`, err)
    })
  }

  private toggleDirectory(
    path: string,
    isExpanded: boolean,
    container: HTMLElement
  ): void {
    // Update expansion state
    this.tree.set(path, !isExpanded)
    // Re-render entire tree
    this.render().catch((err) => console.error('Failed to render:', err))
  }

  private dispatchFileSelect(path: string): void {
    const event = new CustomEvent('file-select', {
      detail: { path },
      bubbles: true,
    })
    this.container.dispatchEvent(event)
  }
}
