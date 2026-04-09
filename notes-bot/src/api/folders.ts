import type { Env } from '../types';
import { authenticate, jsonResponse, errorResponse } from './auth';
import {
  getFoldersByUserId,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
  getUncategorizedCount,
} from '../db/queries';

export async function handleFoldersApi(env: Env, request: Request, path: string): Promise<Response> {
  const user = await authenticate(env, request);
  if (!user) return errorResponse('Unauthorized', 401);

  // GET /api/folders — list folders with note counts + uncategorized count
  if (request.method === 'GET' && path === '/api/folders') {
    const [folders, uncategorized] = await Promise.all([
      getFoldersByUserId(env, user.id),
      getUncategorizedCount(env, user.id),
    ]);
    return jsonResponse({ folders, uncategorized });
  }

  // POST /api/folders — create folder
  if (request.method === 'POST' && path === '/api/folders') {
    const body = await request.json() as { name?: string };
    if (!body.name?.trim()) return errorResponse('name is required');

    const folder = await createFolder(env, user.id, body.name.trim().slice(0, 50));
    return jsonResponse(folder, 201);
  }

  // POST /api/folders/reorder — reorder folders
  if (request.method === 'POST' && path === '/api/folders/reorder') {
    const body = await request.json() as { ids?: number[] };
    if (!Array.isArray(body.ids)) return errorResponse('ids array is required');

    await reorderFolders(env, user.id, body.ids);
    const folders = await getFoldersByUserId(env, user.id);
    return jsonResponse(folders);
  }

  // Match /api/folders/:id
  const folderIdMatch = path.match(/^\/api\/folders\/(\d+)$/);
  if (!folderIdMatch) return errorResponse('Not found', 404);
  const folderId = parseInt(folderIdMatch[1]);

  // GET /api/folders/:id
  if (request.method === 'GET') {
    const folder = await getFolderById(env, folderId, user.id);
    if (!folder) return errorResponse('Not found', 404);
    return jsonResponse(folder);
  }

  // PUT /api/folders/:id — rename folder
  if (request.method === 'PUT') {
    const body = await request.json() as { name?: string };
    if (!body.name?.trim()) return errorResponse('name is required');

    const folder = await getFolderById(env, folderId, user.id);
    if (!folder) return errorResponse('Not found', 404);

    await updateFolder(env, folderId, user.id, body.name.trim().slice(0, 50));
    const updated = await getFolderById(env, folderId, user.id);
    return jsonResponse(updated);
  }

  // DELETE /api/folders/:id
  if (request.method === 'DELETE') {
    const folder = await getFolderById(env, folderId, user.id);
    if (!folder) return errorResponse('Not found', 404);

    await deleteFolder(env, folderId, user.id);
    return jsonResponse({ success: true });
  }

  return errorResponse('Method not allowed', 405);
}
