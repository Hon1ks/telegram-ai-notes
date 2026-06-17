import type { Env, DbNote } from '../types';
import { authenticate, jsonResponse, errorResponse, corsHeaders } from './auth';
import { getAllNotesForExport, getFoldersByUserId, getCategoriesByUserId } from '../db/queries';

function parseTags(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function noteToExportRow(note: DbNote) {
  return {
    id: note.id,
    type: note.type,
    text: note.text,
    tags: parseTags(note.tags),
    done: note.done === 1,
    folder_id: note.folder_id,
    remind_at: note.remind_at,
    created_at: note.created_at,
  };
}

function notesToMarkdown(
  notes: DbNote[],
  categoryNames: Record<string, string>,
  folderNames: Record<number, string>
): string {
  const lines: string[] = ['# AI Notes Export', ''];

  for (const note of notes) {
    const category = categoryNames[note.type] ?? note.type;
    const folder = note.folder_id ? folderNames[note.folder_id] : null;
    const tags = parseTags(note.tags);
    const status = note.done === 1 ? ' [x]' : ' [ ]';

    lines.push(`## ${category}${status}`);
    lines.push('');
    lines.push(note.text);
    if (folder) lines.push('', `_Папка: ${folder}_`);
    if (tags.length > 0) lines.push('', `Теги: ${tags.join(', ')}`);
    if (note.remind_at) lines.push('', `Напоминание: ${note.remind_at}`);
    lines.push('', `Создано: ${note.created_at}`, '', '---', '');
  }

  return lines.join('\n');
}

export async function handleExportApi(
  env: Env,
  request: Request,
  requestId: string
): Promise<Response> {
  const headers = { 'X-Request-Id': requestId };
  const user = await authenticate(env, request);
  if (!user) return errorResponse('Unauthorized', 401, request, env, headers);

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405, request, env, headers);
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') ?? 'json';

  if (format !== 'json' && format !== 'md') {
    return errorResponse('format must be json or md', 400, request, env, headers);
  }

  const [notes, folders, categories] = await Promise.all([
    getAllNotesForExport(env, user.id),
    getFoldersByUserId(env, user.id),
    getCategoriesByUserId(env, user.id),
  ]);

  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const folderNames = Object.fromEntries(folders.map((f) => [f.id, f.name]));
  const exportedAt = new Date().toISOString();

  if (format === 'md') {
    const body = notesToMarkdown(notes, categoryNames, folderNames);
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(request, env),
        ...headers,
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="notes-export.md"',
      },
    });
  }

  return jsonResponse(
    {
      exported_at: exportedAt,
      notes: notes.map(noteToExportRow),
      folders: folders.map((f) => ({ id: f.id, name: f.name, category: f.category })),
      categories: categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        emoji: c.emoji,
      })),
    },
    200,
    request,
    env,
    headers
  );
}