import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js'
import { ChevronDown, ChevronRight, File, Folder, Trash2, Edit2, Plus } from 'lucide-solid'
import { useIDEStore } from './IDEStore'
import type { FileNode, Id, ParentId } from './types'

interface TreeItemProps {
  node: FileNode
  onFileSelect: (id: Id | null) => void
  selectedFileId: Id | null
  level?: number
  onContextMenu: (e: MouseEvent, nodeId: Id) => void
  editingId: Id | null
  onRenameSubmit: (id: Id, newName: string) => void
  onCreateFile: (parentId: ParentId) => void
  onDragStart: (e: DragEvent, node: FileNode) => void
  onDragOver: (e: DragEvent, node: FileNode) => void
  onDrop: (e: DragEvent, targetNode: FileNode) => void
}

const TreeItem = (props: TreeItemProps) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [editValue, setEditValue] = createSignal('')
  const [isHovered, setIsHovered] = createSignal(false)
  const [isDragOver, setIsDragOver] = createSignal(false)
  let inputRef: HTMLInputElement | undefined

  const isFolder = () => props.node.type === 'directory'
  const isSelected = () => props.selectedFileId === props.node.id
  const isEditing = () => props.editingId === props.node.id
  const level = () => props.level || 0

  createEffect(() => {
    if (isEditing()) {
      setEditValue(props.node.name)
    }
  })

  createEffect(() => {
    if (isEditing() && inputRef) {
      inputRef.focus()
      inputRef.select()
    }
  })

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (isFolder()) {
      setIsOpen(!isOpen())
    } else {
      props.onFileSelect(props.node.id)
    }
  }

  const handleRightClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    props.onContextMenu(e, props.node.id)
  }

  const handleCreateClick = (e: MouseEvent) => {
    e.stopPropagation()
    props.onCreateFile(props.node.id)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      props.onRenameSubmit(props.node.id, editValue())
    } else if (e.key === 'Escape') {
      props.onRenameSubmit(props.node.id, props.node.name)
    }
  }

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation()
    props.onDragStart(e, props.node)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isFolder()) {
      setIsDragOver(true)
      props.onDragOver(e, props.node)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    props.onDrop(e, props.node)
  }

  return (
    <div
      draggable={!isEditing()}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        class={`tree-item ${isSelected() ? 'selected' : ''}`}
        style={{
          'padding-left': `${10 + level() * 12}px`,
          'background-color': isDragOver() ? '#37373d' : undefined,
          border: isDragOver() ? '1px dashed #007fd4' : '1px solid transparent'
        }}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span style={{ 'margin-right': '4px', display: 'flex', 'align-items': 'center', opacity: 0.8 }}>
          <Show when={isFolder()} fallback={<span style={{ width: '14px' }} />}>
            <Show when={isOpen()} fallback={<ChevronRight size={14} />}>
              <ChevronDown size={14} />
            </Show>
          </Show>
        </span>

        <span
          style={{
            'margin-right': '6px',
            display: 'flex',
            'align-items': 'center',
            color: isFolder() ? '#dcb67a' : '#858585'
          }}
        >
          <Show when={isFolder()} fallback={<File size={14} strokeWidth={1.5} />}>
            <Folder size={14} fill="#dcb67a" strokeWidth={1} />
          </Show>
        </span>

        <Show when={isEditing()} fallback={<span style={{ flex: 1 }}>{props.node.name}</span>}>
          <input
            ref={inputRef}
            type="text"
            value={editValue()}
            onInput={e => setEditValue(e.currentTarget.value)}
            onBlur={() => props.onRenameSubmit(props.node.id, editValue())}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            class="file-rename-input"
            style={{
              background: '#3c3c3c',
              border: '1px solid #007fd4',
              color: 'white',
              outline: 'none',
              padding: '1px 4px',
              'font-size': 'inherit',
              width: '100%'
            }}
          />
        </Show>

        <Show when={isFolder() && isHovered() && !isEditing()}>
          <span
            onClick={handleCreateClick}
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              color: '#cccccc',
              'margin-right': '4px'
            }}
            title="New File"
          >
            <Plus size={14} />
          </span>
        </Show>
      </div>

      <Show when={isFolder() && isOpen() && props.node.children}>
        <div>
          <For each={props.node.children}>
            {child => (
              <TreeItem
                node={child}
                onFileSelect={props.onFileSelect}
                selectedFileId={props.selectedFileId}
                level={level() + 1}
                onContextMenu={props.onContextMenu}
                editingId={props.editingId}
                onRenameSubmit={props.onRenameSubmit}
                onCreateFile={props.onCreateFile}
                onDragStart={props.onDragStart}
                onDragOver={props.onDragOver}
                onDrop={props.onDrop}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

interface FileTreeProps extends Pick<TreeItemProps, 'selectedFileId' | 'onFileSelect'> {
  nodes: TreeItemProps['node'][]
}

export function FileTree(props: FileTreeProps) {
  const ide = useIDEStore()
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; nodeId: Id } | null>(null)
  const [editingId, setEditingId] = createSignal<Id | null>(null)
  const [draggedNode, setDraggedNode] = createSignal<FileNode | null>(null)

  const handleClickOutside = () => setContextMenu(null)

  onCleanup(() => window.removeEventListener('click', handleClickOutside))

  const handleContextMenu = (e: MouseEvent, nodeId: Id) => {
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId })
  }

  const handleRenameSubmit = (id: Id, newName: string) => {
    if (newName && newName.trim() !== '') {
      ide().renameNode(id, newName)
    }
    setEditingId(null)
  }

  const handleDelete = () => {
    const menu = contextMenu()
    if (menu?.nodeId) {
      if (confirm('Delete this item?')) {
        ide().deleteNode(menu.nodeId)
      }
    }
  }

  const handleStartRename = () => {
    const menu = contextMenu()
    if (menu?.nodeId) {
      setEditingId(menu.nodeId)
      setContextMenu(null)
    }
  }

  const handleCreateFile = async (parentId: ParentId) => {
    const name = prompt('Enter file name:')
    if (name) {
      await ide().createFile(name, 'file', parentId)
    }
  }

  const onDragStart = (e: DragEvent, node: FileNode) => {
    setDraggedNode(node)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  const onDragOver = (e: DragEvent, node: FileNode) => {
    const dragged = draggedNode()

    if (node.type === 'directory' && dragged && dragged.id !== node.id) {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
    }
  }

  const onDrop = (_: DragEvent, targetNode: FileNode) => {
    const dragged = draggedNode()
    if (dragged && targetNode.type === 'directory' && dragged.id !== targetNode.id) {
      ide().moveNode(dragged.id, targetNode.id)
      setDraggedNode(null)
    }
  }

  const onRootDrop = (e: DragEvent) => {
    e.preventDefault()
    const dragged = draggedNode()
    if (dragged) {
      ide().moveNode(dragged.id, null)
      setDraggedNode(null)
    }
  }

  const onRootDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  return (
    <div onDragOver={onRootDragOver} onDrop={onRootDrop}>
      <div class="file-tree-title">Explorer</div>
      <For each={props.nodes}>
        {node => (
          <TreeItem
            node={node}
            onFileSelect={props.onFileSelect}
            selectedFileId={props.selectedFileId}
            onContextMenu={handleContextMenu}
            editingId={editingId()}
            onRenameSubmit={handleRenameSubmit}
            onCreateFile={handleCreateFile}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        )}
      </For>

      <Show when={contextMenu()}>
        {menu => (
          <div
            class="context-menu"
            style={{
              position: 'fixed',
              top: `${menu().y}px`,
              left: `${menu().x}px`,
              'background-color': '#252526',
              border: '1px solid #454545',
              'border-radius': '4px',
              padding: '4px 0',
              'z-index': 1000,
              'box-shadow': '0 2px 8px rgba(0,0,0,0.5)'
            }}
          >
            <div
              class="context-menu-item"
              onClick={handleStartRename}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                'font-size': '13px',
                display: 'flex',
                'align-items': 'center',
                gap: '8px',
                color: '#cccccc',
                'user-select': 'none'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#094771')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Edit2 size={14} /> Rename
            </div>
            <div
              class="context-menu-item"
              onClick={handleDelete}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                'font-size': '13px',
                display: 'flex',
                'align-items': 'center',
                gap: '8px',
                color: '#ff6b6b',
                'user-select': 'none'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#094771')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Trash2 size={14} /> Delete
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
