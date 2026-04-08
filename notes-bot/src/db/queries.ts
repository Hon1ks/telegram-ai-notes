import type { Env, DbUser, DbFolder, DbNote } from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getOrCreateUser(env: Env, telegramId: number): Promise<DbUser> {
  const existing = await env.NOTES_DB
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(String(telegramId))
    .first<DbUser>();

  if (existing) return existing;

  await env.NOTES_DB
    .prepare('INSERT INTO users (telegram_id, state) VALUES (?, ?)')
    .bind(String(telegramId), 'idle')
    .run();

  const created = await env.NOTES_DB
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(String(telegramId))
    .first<DbUser>();

  return created!;
}

export async function getUserByTelegramId(env: Env, telegramId: number): Promise<DbUser | null> {
  return env.NOTES_DB
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(String(telegramId))
    .first<DbUser>();
}

export async function updateUserState(env: Env, userId: number, state: string): Promise<void> {
  await env.NOTES_DB
    .prepare('UPDATE users SET state = ? WHERE id = ?')
    .bind(state, userId)
    .run();
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export async function createFolder(env: Env, userId: number, name: string): Promise<DbFolder> {
  const count = await env.NOTES_DB
    .prepare('SELECT COUNT(*) as cnt FROM folders WHERE user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>();

  const sortOrder = (count?.cnt ?? 0);

  await env.NOTES_DB
    .prepare('INSERT INTO folders (user_id, name, sort_order) VALUES (?, ?, ?)')
    .bind(userId, name, sortOrder)
    .run();

  const folder = await env.NOTES_DB
    .prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .bind(userId)
    .first<DbFolder>();

  return folder!;
}

export async function getFoldersByUserId(env: Env, userId: number): Promise<DbFolder[]> {
  const result = await env.NOTES_DB
    .prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY sort_order ASC, id ASC')
    .bind(userId)
    .all<DbFolder>();

  return result.results;
}

export async function getFolderById(env: Env, folderId: number, userId: number): Promise<DbFolder | null> {
  return env.NOTES_DB
    .prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
    .bind(folderId, userId)
    .first<DbFolder>();
}

export async function updateFolder(env: Env, folderId: number, userId: number, name: string): Promise<void> {
  await env.NOTES_DB
    .prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?')
    .bind(name, folderId, userId)
    .run();
}

export async function deleteFolder(env: Env, folderId: number, userId: number): Promise<void> {
  // Открепляем заметки из этой папки
  await env.NOTES_DB
    .prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ? AND user_id = ?')
    .bind(folderId, userId)
    .run();

  await env.NOTES_DB
    .prepare('DELETE FROM folders WHERE id = ? AND user_id = ?')
    .bind(folderId, userId)
    .run();
}

export async function reorderFolders(env: Env, userId: number, orderedIds: number[]): Promise<void> {
  const stmts = orderedIds.map((id, index) =>
    env.NOTES_DB
      .prepare('UPDATE folders SET sort_order = ? WHERE id = ? AND user_id = ?')
      .bind(index, id, userId)
  );
  await env.NOTES_DB.batch(stmts);
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function createNote(
  env: Env,
  userId: number,
  type: string,
  text: string,
  folderId?: number | null
): Promise<DbNote> {
  await env.NOTES_DB
    .prepare('INSERT INTO notes (user_id, folder_id, type, text) VALUES (?, ?, ?, ?)')
    .bind(userId, folderId ?? null, type, text)
    .run();

  const note = await env.NOTES_DB
    .prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .bind(userId)
    .first<DbNote>();

  return note!;
}

export async function getNotesByUserId(
  env: Env,
  userId: number,
  type?: string,
  folderId?: number
): Promise<DbNote[]> {
  let query = 'SELECT * FROM notes WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (folderId !== undefined) {
    query += ' AND folder_id = ?';
    params.push(folderId);
  }

  query += ' ORDER BY created_at DESC';

  const result = await env.NOTES_DB
    .prepare(query)
    .bind(...params)
    .all<DbNote>();

  return result.results;
}

export async function getNoteById(env: Env, noteId: number, userId: number): Promise<DbNote | null> {
  return env.NOTES_DB
    .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .first<DbNote>();
}

export async function updateNote(
  env: Env,
  noteId: number,
  userId: number,
  fields: { text?: string; done?: number; folder_id?: number | null }
): Promise<void> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (fields.text !== undefined) { sets.push('text = ?'); params.push(fields.text); }
  if (fields.done !== undefined) { sets.push('done = ?'); params.push(fields.done); }
  if ('folder_id' in fields) { sets.push('folder_id = ?'); params.push(fields.folder_id ?? null); }

  if (sets.length === 0) return;

  params.push(noteId, userId);
  await env.NOTES_DB
    .prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...params)
    .run();
}

export async function deleteNote(env: Env, noteId: number, userId: number): Promise<void> {
  await env.NOTES_DB
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .run();
}
