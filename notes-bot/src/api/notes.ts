import type { Env } from '../types';
import { authenticate, jsonResponse, errorResponse } from './auth';
import {
  getNotesByUserId, getNoteById, createNote, updateNote, deleteNote,
  searchNotes, getUserTags, getFolderById,
  softDeleteNote, restoreNote,
} from '../db/queries';
import {
  parsePositiveInt,
  readJsonBody,
  validateFolderId,
  validateNoteText,
  validateRemindAt,
  validateTags,
  validateUserCategorySlug,
} from './validation';
import { DEFAULT_CATEGORY_SLUG } from '../categories/defaults';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function handleNotesApi(
  env: Env,
  request: Request,
  path: string,
  requestId: string
): Promise<Response> {
  const headers = { 'X-Request-Id': requestId };
  const user = await authenticate(env, request);
  if (!user) return errorResponse('Unauthorized', 401, request, env, headers);

  const url = new URL(request.url);

  if (request.method === 'GET' && path === '/api/tags') {
    const tags = await getUserTags(env, user.id);
    return jsonResponse(tags, 200, request, env, headers);
  }

  if (request.method === 'GET' && path === '/api/notes/search') {
    const q = url.searchParams.get('q')?.trim();
    if (!q) return jsonResponse([], 200, request, env, headers);
    if (q.length > 200) return errorResponse('search query is too long', 400, request, env, headers);
    const notes = await searchNotes(env, user.id, q);
    return jsonResponse(notes, 200, request, env, headers);
  }

  if (request.method === 'GET' && path === '/api/notes') {
    const type = url.searchParams.get('type') ?? undefined;
    const folderIdStr = url.searchParams.get('folder_id');
    const folderId = folderIdStr === null ? undefined : parsePositiveInt(folderIdStr);
    const tag = url.searchParams.get('tag') ?? undefined;
    const trash = url.searchParams.get('trash') === '1';
    const limitRaw = parsePositiveInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT));
    const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
    const limit = Math.min(limitRaw ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Number.isSafeInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    if (type !== undefined && !(await validateUserCategorySlug(env, user.id, type))) {
      return errorResponse('invalid type', 400, request, env, headers);
    }
    if (folderIdStr !== null && folderId === undefined) {
      return errorResponse('invalid folder_id', 400, request, env, headers);
    }

    const notes = await getNotesByUserId(env, user.id, type, folderId, tag, limit, offset, trash);
    return jsonResponse(notes, 200, request, env, headers);
  }

  if (request.method === 'POST' && path === '/api/notes') {
    const body = await readJsonBody<{
      text?: string;
      type?: string;
      folder_id?: number | null;
      tags?: string[];
      remind_at?: string | null;
    }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);

    const text = validateNoteText(body.text);
    const type = body.type ?? DEFAULT_CATEGORY_SLUG;
    const folderId = validateFolderId(body.folder_id ?? null);
    const tags = validateTags(body.tags);
    const remindAt = validateRemindAt(body.remind_at);

    if (!text) return errorResponse('text is required and must be at most 10000 characters', 400, request, env, headers);
    if (!(await validateUserCategorySlug(env, user.id, type))) {
      return errorResponse('invalid type', 400, request, env, headers);
    }
    if (folderId === undefined) return errorResponse('invalid folder_id', 400, request, env, headers);
    if (tags === null) return errorResponse('invalid tags', 400, request, env, headers);
    if (remindAt === null && body.remind_at !== undefined && body.remind_at !== null) {
      return errorResponse('invalid remind_at', 400, request, env, headers);
    }
    if (folderId !== null && !(await getFolderById(env, folderId, user.id))) {
      return errorResponse('folder not found', 404, request, env, headers);
    }

    const note = await createNote(env, user.id, type, text, tags, folderId);
    if (remindAt !== undefined) {
      await updateNote(env, note.id, user.id, { remind_at: remindAt });
      const updated = await getNoteById(env, note.id, user.id);
      return jsonResponse(updated, 201, request, env, headers);
    }
    return jsonResponse(note, 201, request, env, headers);
  }

  const restoreMatch = path.match(/^\/api\/notes\/(\d+)\/restore$/);
  if (restoreMatch && request.method === 'POST') {
    const noteId = parsePositiveInt(restoreMatch[1]);
    if (!noteId) return errorResponse('Not found', 404, request, env, headers);

    const trashed = await getNoteById(env, noteId, user.id, { includeDeleted: true });
    if (!trashed || !trashed.deleted_at) {
      return errorResponse('Not found', 404, request, env, headers);
    }

    await restoreNote(env, noteId, user.id);
    const restored = await getNoteById(env, noteId, user.id);
    return jsonResponse(restored, 200, request, env, headers);
  }

  const permanentMatch = path.match(/^\/api\/notes\/(\d+)\/permanent$/);
  if (permanentMatch && request.method === 'DELETE') {
    const noteId = parsePositiveInt(permanentMatch[1]);
    if (!noteId) return errorResponse('Not found', 404, request, env, headers);

    const trashed = await getNoteById(env, noteId, user.id, { includeDeleted: true });
    if (!trashed || !trashed.deleted_at) {
      return errorResponse('Not found', 404, request, env, headers);
    }

    await deleteNote(env, noteId, user.id);
    return jsonResponse({ success: true }, 200, request, env, headers);
  }

  const noteIdMatch = path.match(/^\/api\/notes\/(\d+)$/);
  if (!noteIdMatch) return errorResponse('Not found', 404, request, env, headers);
  const noteId = parsePositiveInt(noteIdMatch[1]);
  if (!noteId) return errorResponse('Not found', 404, request, env, headers);

  if (request.method === 'GET') {
    const note = await getNoteById(env, noteId, user.id);
    if (!note) return errorResponse('Not found', 404, request, env, headers);
    return jsonResponse(note, 200, request, env, headers);
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody<{
      text?: string;
      done?: number;
      folder_id?: number | null;
      tags?: string[];
      type?: string;
      remind_at?: string | null;
    }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);

    const note = await getNoteById(env, noteId, user.id);
    if (!note) return errorResponse('Not found', 404, request, env, headers);

    const fields: {
      text?: string;
      done?: number;
      folder_id?: number | null;
      tags?: string[];
      type?: string;
      remind_at?: string | null;
    } = {};

    if ('text' in body) {
      const text = validateNoteText(body.text);
      if (!text) return errorResponse('invalid text', 400, request, env, headers);
      fields.text = text;
    }
    if ('done' in body) {
      if (body.done !== 0 && body.done !== 1) return errorResponse('done must be 0 or 1', 400, request, env, headers);
      fields.done = body.done;
    }
    if ('folder_id' in body) {
      const folderId = validateFolderId(body.folder_id);
      if (folderId === undefined) return errorResponse('invalid folder_id', 400, request, env, headers);
      if (folderId !== null && !(await getFolderById(env, folderId, user.id))) {
        return errorResponse('folder not found', 404, request, env, headers);
      }
      fields.folder_id = folderId;
    }
    if ('tags' in body) {
      const tags = validateTags(body.tags);
      if (tags === null) return errorResponse('invalid tags', 400, request, env, headers);
      fields.tags = tags;
    }
    if ('type' in body) {
      const type = await validateUserCategorySlug(env, user.id, body.type);
      if (!type) return errorResponse('invalid type', 400, request, env, headers);
      fields.type = type;
    }
    if ('remind_at' in body) {
      const remindAt = validateRemindAt(body.remind_at);
      if (remindAt === null && body.remind_at !== undefined && body.remind_at !== null) {
        return errorResponse('invalid remind_at', 400, request, env, headers);
      }
      fields.remind_at = remindAt ?? null;
    }

    await updateNote(env, noteId, user.id, fields);
    const updated = await getNoteById(env, noteId, user.id);
    return jsonResponse(updated, 200, request, env, headers);
  }

  if (request.method === 'DELETE') {
    const note = await getNoteById(env, noteId, user.id);
    if (!note) return errorResponse('Not found', 404, request, env, headers);

    await softDeleteNote(env, noteId, user.id);
    return jsonResponse({ success: true }, 200, request, env, headers);
  }

  return errorResponse('Method not allowed', 405, request, env, headers);
}