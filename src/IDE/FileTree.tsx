import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, File, Folder, Trash2, Edit2, Plus } from 'lucide-react';
import { useIDE } from './useIDE';

export interface FileNode {
  id: string;
  name: string;
  parentId: string | null;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
  onFileSelect: (id: string) => void;
  selectedFileId: string | null;
}

const TreeItem = ({
  node,
  onFileSelect,
  selectedFileId,
  level = 0,
  onContextMenu,
  editingId,
  onRenameSubmit,
  onCreateFile
}: {
  node: FileNode;
  onFileSelect: (id: string) => void;
  selectedFileId: string | null;
  level?: number;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  editingId: string | null;
  onRenameSubmit: (id: string, newName: string) => void;
  onCreateFile: (parentId: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFolder = node.type === 'folder';
  const isSelected = selectedFileId === node.id;
  const isEditing = editingId === node.id;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node.id);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.id);
  };

  const handleCreateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateFile(node.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onRenameSubmit(node.id, editValue);
    } else if (e.key === 'Escape') {
      onRenameSubmit(node.id, node.name);
    }
  };

  return (
    <div>
      <div
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${10 + level * 12}px` }}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span
          style={{
            marginRight: '4px',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.8
          }}
        >
          {
            isFolder ?
              isOpen ?
                <ChevronDown size={14} />
              : <ChevronRight size={14} />
            : <span style={{ width: 14 }} /> // Spacer for alignment
          }
        </span>

        <span
          style={{
            marginRight: '6px',
            display: 'flex',
            alignItems: 'center',
            color: isFolder ? '#dcb67a' : '#858585'
          }}
        >
          {isFolder ?
            <Folder size={14} fill="#dcb67a" strokeWidth={1} />
          : <File size={14} strokeWidth={1.5} />}
        </span>

        {isEditing ?
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onRenameSubmit(node.id, editValue)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="file-rename-input"
            style={{
              background: '#3c3c3c',
              border: '1px solid #007fd4',
              color: 'white',
              outline: 'none',
              padding: '1px 4px',
              fontSize: 'inherit',
              width: '100%'
            }}
          />
        : <span style={{ flex: 1 }}>{node.name}</span>}

        {isFolder && isHovered && !isEditing && (
          <span
            onClick={handleCreateClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              color: '#cccccc',
              marginRight: '4px'
            }}
            title="New File"
          >
            <Plus size={14} />
          </span>
        )}
      </div>

      {isFolder && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              onFileSelect={onFileSelect}
              selectedFileId={selectedFileId}
              level={level + 1}
              onContextMenu={onContextMenu}
              editingId={editingId}
              onRenameSubmit={onRenameSubmit}
              onCreateFile={onCreateFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function FileTree({
  nodes,
  onFileSelect,
  selectedFileId
}: FileTreeProps) {
  const { renameNode, deleteNode, createFile } = useIDE();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  const handleRenameSubmit = (id: string, newName: string) => {
    if (newName && newName.trim() !== '') {
      renameNode(id, newName);
    }
    setEditingId(null);
  };

  const handleDelete = () => {
    if (contextMenu?.nodeId) {
      if (confirm('Delete this item?')) {
        deleteNode(contextMenu.nodeId);
      }
    }
  };

  const handleStartRename = () => {
    if (contextMenu?.nodeId) {
      setEditingId(contextMenu.nodeId);
      setContextMenu(null); // Close menu
    }
  };

  const handleCreateFile = async (parentId: string) => {
    const name = prompt('Enter file name:');
    if (name) {
      await createFile(name, 'file', parentId);
    }
  };

  return (
    <div className="sidebar" style={{ position: 'relative' }}>
      <div className="file-tree-title">Explorer</div>
      <div className="file-tree-container">
        {nodes.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            onFileSelect={onFileSelect}
            selectedFileId={selectedFileId}
            onContextMenu={handleContextMenu}
            editingId={editingId}
            onRenameSubmit={handleRenameSubmit}
            onCreateFile={handleCreateFile}
          />
        ))}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#252526',
            border: '1px solid #454545',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}
        >
          <div
            className="context-menu-item"
            onClick={handleStartRename}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#cccccc',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#094771'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Edit2 size={14} /> Rename
          </div>
          <div
            className="context-menu-item"
            onClick={handleDelete}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ff6b6b',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#094771'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={14} /> Delete
          </div>
        </div>
      )}
    </div>
  );
}
