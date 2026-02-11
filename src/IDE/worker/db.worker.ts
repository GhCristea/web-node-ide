import * as db from '../db';
import type { WorkerRequest, WorkerResponse } from './types';

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, reqId } = e.data;

  try {
    switch (type) {
      case 'INIT_DB': {
        await db.initDb();
        postResponse({ type: 'INIT_DB_SUCCESS', reqId });
        break;
      }
      case 'GET_FILES': {
        const files = await db.getFilesFromDb();
        // Map db FileRecord to service FileRecord if needed, assuming they match for now
        // Types in db.ts: FileRecord { id, name, parentId, type, content, updated_at }
        postResponse({ type: 'GET_FILES_SUCCESS', reqId, files: files as any });
        break;
      }
      case 'GET_FILE_CONTENT': {
        const content = await db.getFileContent(e.data.fileId);
        postResponse({ type: 'GET_FILE_CONTENT_SUCCESS', reqId, content });
        break;
      }
      case 'SAVE_FILE': {
        await db.saveFileContent(e.data.fileId, e.data.content);
        postResponse({ type: 'SAVE_FILE_SUCCESS', reqId });
        break;
      }
      case 'CREATE_FILE': {
        const id = await db.createFile(e.data.name, e.data.parentId, e.data.nodeType, e.data.content || '');
        postResponse({ type: 'CREATE_FILE_SUCCESS', reqId, fileId: id });
        break;
      }
      case 'DELETE_FILE': {
        await db.deleteFile(e.data.fileId);
        postResponse({ type: 'DELETE_FILE_SUCCESS', reqId });
        break;
      }
      case 'RENAME_FILE': {
        await db.renameFile(e.data.fileId, e.data.newName);
        postResponse({ type: 'RENAME_FILE_SUCCESS', reqId });
        break;
      }
      case 'MOVE_FILE': {
        await db.moveFile(e.data.fileId, e.data.newParentId);
        postResponse({ type: 'MOVE_FILE_SUCCESS', reqId });
        break;
      }
      case 'RESET_FS': {
        await db.resetFileSystem();
        postResponse({ type: 'RESET_FS_SUCCESS', reqId });
        break;
      }
      default:
        console.warn('Unknown worker request type:', (e.data as any).type);
    }
  } catch (error) {
    postResponse({ type: 'ERROR', reqId, error: String(error) });
  }
};

function postResponse(response: WorkerResponse) {
  self.postMessage(response);
}
