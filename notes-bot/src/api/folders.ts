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
import { parsePositiveInt, readJsonBody, validateUserCategorySlug } from './validation';

export async function handleFoldersApi(
  env: Env,
  request: Request,
  path: string,
  requestId: string
): Promise<Response> {
  const headers = { 'X-Request-Id': requestId };
  const user = await authenticate(env, request);
  if (!user) return errorResponse('Unauthorized', 401, request, env, headers);

  if (request.method === 'GET' && path === '/api/folders') {
    const [folders, uncategorized] = await Promise.all([
      getFoldersByUserId(env, user.id),
      getUncategorizedCount(env, user.id),
    ]);
    return jsonResponse({ folders, uncategorized }, 200, request, env, headers);
  }

  if (request.method === 'POST' && path === '/api/folders') {
    const body = await readJsonBody<{ name?: string; category?: string | null }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);
    if (!body.name?.trim()) return errorResponse('name is required', 400, request, env, headers);
    if (body.category !== undefined && body.category !== null) {
      const category = await validateUserCategorySlug(env, user.id, body.category);
      if (!category) return errorResponse('invalid category', 400, request, env, headers);
    }

    const folder = await createFolder(
      env,
      user.id,
      body.name.trim().slice(0, 50),
      body.category ?? null
    );
    return jsonResponse(folder, 201, request, env, headers);
  }

  if (request.method === 'POST' && path === '/api/folders/reorder') {
    const body = await readJsonBody<{ ids?: number[] }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);
    if (!Array.isArray(body.ids)) return errorResponse('ids array is required', 400, request, env, headers);
    if (!body.ids.every(id => Number.isSafeInteger(id) && id > 0)) {
      return errorResponse('ids must contain positive integers', 400, request, env, headers);
    }

    const folders = await getFoldersByUserId(env, user.id);
    const ownedIds = new Set(folders.map(folder => folder.id));
    if (body.ids.length !== ownedIds.size || new Set(body.ids).size !== body.ids.length) {
      return errorResponse('ids must contain every folder exactly once', 400, request, env, headers);
    }
    if (!body.ids.every(id => ownedIds.has(id))) return errorResponse('folder not found', 404, request, env, headers);

    await reorderFolders(env, user.id, body.ids);
    const updatedFolders = await getFoldersByUserId(env, user.id);
    return jsonResponse(updatedFolders, 200, request, env, headers);
  }

  const folderIdMatch = path.match(/^\/api\/folders\/(\d+)$/);
  if (!folderIdMatch) return errorResponse('Not found', 404, request, env, headers);
  const folderId = parsePositiveInt(folderIdMatch[1]);
  if (!folderId) return errorResponse('Not found', 404, request, env, headers);

  if (request.method === 'GET') {
    const folder = await getFolderById(env, folderId, user.id);
    if (!folder) return errorResponse('Not found', 404, request, env, headers);
    return jsonResponse(folder, 200, request, env, headers);
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody<{ name?: string; category?: string | null }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);
    if (!body.name?.trim()) return errorResponse('name is required', 400, request, env, headers);
    if (body.category !== undefined && body.category !== null) {
      const category = await validateUserCategorySlug(env, user.id, body.category);
      if (!category) return errorResponse('invalid category', 400, request, env, headers);
    }

    const folder = await getFolderById(env, folderId, user.id);
    if (!folder) return errorResponse('Not found', 404, request, env, headers);

    await updateFolder(env, folderId, user.id, body.name.trim().slice(0, 50), body.category);
    const updated = await getFolderById(env, folderId, user.id);
    return jsonResponse(updated, 200, request, env, headers);
  }

  if (request.method === 'DELETE') {
    const folder = await getFolderById(env, folderId, user.id);
    if (!folder) return errorResponse('Not found', 404, request, env, headers);

    await deleteFolder(env, folderId, user.id);
    return jsonResponse({ success: true }, 200, request, env, headers);
  }

  return errorResponse('Method not allowed', 405, request, env, headers);
}