import type { Env } from '../types';
import { authenticate, jsonResponse, errorResponse } from './auth';
import { getNotesByUserId, getNoteById, createNote, updateNote, deleteNote } from '../db/queries';

export async function handleNotesApi(env: Env, request: Request, path: string): Promise<Response> {
  const user = await authenticate(env, request);
  if (!user) return errorResponse('Unauthorized', 401);

  const url = new URL(request.url);

  // GET /api/notes — list notes (with optional ?type= and ?folder_id= filters)
  if (request.method === 'GET' && path === '/api/notes') {
    const type = url.searchParams.get('type') ?? undefined;
    const folderIdStr = url.searchParams.get('folder_id');
    const folderId = folderIdStr ? parseInt(folderIdStr) : undefined;

    const notes = await getNotesByUserId(env, user.id, type, folderId);
    return jsonResponse(notes);
  }

  // POST /api/notes — create note
  if (request.method === 'POST' && path === '/api/notes') {
    const body = await request.json() as {
      text?: string;
      type?: string;
      folder_id?: number | null;
    };

    if (!body.text?.trim()) return errorResponse('text is required');

    const note = await createNote(
      env,
      user.id,
      body.type ?? 'notes',
      body.text.trim(),
      body.folder_id ?? null
    );

    return jsonResponse(note, 201);
  }

  // Match /api/notes/:id
  const noteIdMatch = path.match(/^\/api\/notes\/(\d+)$/);
  if (!noteIdMatch) return errorResponse('Not found', 404);
  const noteId = parseInt(noteIdMatch[1]);

  // GET /api/notes/:id
  if (request.method === 'GET') {
    const note = await getNoteById(env, noteId, user.id);
    if (!note) return errorResponse('Not found', 404);
    return jsonResponse(note);
  }

  // PUT /api/notes/:id — update note
  if (request.method === 'PUT') {
    const body = await request.json() as {
      text?: string;
      done?: number;
      folder_id?: number | null;
    };

    const note = await getNoteById(env, noteId, user.id);
    if (!note) return errorResponse('Not found', 404);

    await updateNote(env, noteId, user.id, body);
    const updated = await getNoteById(env, noteId, user.id);
    return jsonResponse(updated);
  }

  // DELETE /api/notes/:id
  if (request.method === 'DELETE') {
    const note = await getNoteById(env, noteId, user.id);
    if (!note) return errorResponse('Not found', 404);

    await deleteNote(env, noteId, user.id);
    return jsonResponse({ success: true });
  }

  return errorResponse('Method not allowed', 405);
}
