import type { FileRecord } from '../service/types';

export type WorkerRequest =
  | { type: 'INIT_DB'; reqId: string }
  | { type: 'GET_FILES'; reqId: string }
  | { type: 'GET_FILE_CONTENT'; reqId: string; fileId: string }
  | { type: 'SAVE_FILE'; reqId: string; fileId: string; content: string }
  | { type: 'CREATE_FILE'; reqId: string; name: string; parentId: string | null; nodeType: 'file' | 'folder'; content?: string }
  | { type: 'DELETE_FILE'; reqId: string; fileId: string }
  | { type: 'RENAME_FILE'; reqId: string; fileId: string; newName: string }
  | { type: 'MOVE_FILE'; reqId: string; fileId: string; newParentId: string | null }
  | { type: 'RESET_FS'; reqId: string };

export type WorkerResponse =
  | { type: 'INIT_DB_SUCCESS'; reqId: string }
  | { type: 'GET_FILES_SUCCESS'; reqId: string; files: FileRecord[] }
  | { type: 'GET_FILE_CONTENT_SUCCESS'; reqId: string; content: string }
  | { type: 'SAVE_FILE_SUCCESS'; reqId: string }
  | { type: 'CREATE_FILE_SUCCESS'; reqId: string; fileId: string }
  | { type: 'DELETE_FILE_SUCCESS'; reqId: string }
  | { type: 'RENAME_FILE_SUCCESS'; reqId: string }
  | { type: 'MOVE_FILE_SUCCESS'; reqId: string }
  | { type: 'RESET_FS_SUCCESS'; reqId: string }
  | { type: 'ERROR'; reqId: string; error: string };
