import type { FileRecord } from '../service/types';
import type { WorkerRequest, WorkerResponse } from './types';

/**
 * Thin client wrapper around the DB worker.
 * Provides a promise-based API that matches db.ts signatures.
 */
export class DBWorkerClient {
  private worker: Worker;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private reqCounter = 0;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = this.handleResponse.bind(this);
  }

  private handleResponse(e: MessageEvent<WorkerResponse>) {
    const { reqId, type } = e.data;
    const pending = this.pendingRequests.get(reqId);
    if (!pending) return;

    this.pendingRequests.delete(reqId);

    if (type === 'ERROR') {
      pending.reject(new Error(e.data.error));
      return;
    }

    switch (type) {
      case 'INIT_DB_SUCCESS':
        pending.resolve(undefined);
        break;
      case 'GET_FILES_SUCCESS':
        pending.resolve(e.data.files);
        break;
      case 'GET_FILE_CONTENT_SUCCESS':
        pending.resolve(e.data.content);
        break;
      case 'SAVE_FILE_SUCCESS':
        pending.resolve(undefined);
        break;
      case 'CREATE_FILE_SUCCESS':
        pending.resolve(e.data.fileId);
        break;
      case 'DELETE_FILE_SUCCESS':
        pending.resolve(undefined);
        break;
      case 'RENAME_FILE_SUCCESS':
        pending.resolve(undefined);
        break;
      case 'MOVE_FILE_SUCCESS':
        pending.resolve(undefined);
        break;
      case 'RESET_FS_SUCCESS':
        pending.resolve(undefined);
        break;
    }
  }

  private sendRequest<T>(request: Omit<WorkerRequest, 'reqId'>): Promise<T> {
    const reqId = `req_${++this.reqCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject });
      this.worker.postMessage({ ...request, reqId });
    });
  }

  initDb(): Promise<unknown> {
    return this.sendRequest({ type: 'INIT_DB' });
  }

  getFilesFromDb(): Promise<FileRecord[]> {
    return this.sendRequest({ type: 'GET_FILES' });
  }

  getFileContent(fileId: string): Promise<string> {
    return this.sendRequest({ type: 'GET_FILE_CONTENT', fileId });
  }

  saveFileContent(fileId: string, content: string): Promise<void> {
    return this.sendRequest({ type: 'SAVE_FILE', fileId, content });
  }

  createFile(
    name: string,
    parentId: string | null,
    nodeType: 'file' | 'folder',
    content: string = ''
  ): Promise<string> {
    return this.sendRequest({ type: 'CREATE_FILE', name, parentId, nodeType, content });
  }

  deleteFile(fileId: string): Promise<void> {
    return this.sendRequest({ type: 'DELETE_FILE', fileId });
  }

  renameFile(fileId: string, newName: string): Promise<void> {
    return this.sendRequest({ type: 'RENAME_FILE', fileId, newName });
  }

  moveFile(fileId: string, newParentId: string | null): Promise<void> {
    return this.sendRequest({ type: 'MOVE_FILE', fileId, newParentId });
  }

  resetFileSystem(): Promise<void> {
    return this.sendRequest({ type: 'RESET_FS' });
  }
}
