import { useState } from 'react';
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';

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
  level = 0
}: {
  node: FileNode;
  onFileSelect: (id: string) => void;
  selectedFileId: string | null;
  level?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = node.type === 'folder';
  const isSelected = selectedFileId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node.id);
    }
  };

  return (
    <div>
      <div
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${10 + level * 12}px` }}
        onClick={handleClick}
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

        <span>{node.name}</span>
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
  return (
    <div className="sidebar">
      <div className="file-tree-title">Explorer</div>
      <div className="file-tree-container">
        {nodes.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            onFileSelect={onFileSelect}
            selectedFileId={selectedFileId}
          />
        ))}
      </div>
    </div>
  );
}
