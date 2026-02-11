export interface FileRecord {
  id: string;
  name: string;
  parentId: string | null;
  type: 'file' | 'folder';
  content: string | null;
  updated_at: string;
}
