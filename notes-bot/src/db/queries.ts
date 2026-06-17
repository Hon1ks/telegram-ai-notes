import type { Env, DbUser, DbFolder, DbNote, DbCategory, DueReminder } from '../types';
import {
  DEFAULT_CATEGORY_SLUG,
  MAX_CATEGORIES_PER_USER,
  SYSTEM_CATEGORIES,
} from '../categories/defaults';

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getOrCreateUser(env: Env, telegramId: number): Promise<DbUser> {
  const existing = await env.NOTES_DB
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(String(telegramId))
    .first<DbUser>();

  if (existing) {
    await ensureDefaultCategories(env, existing.id);
    return existing;
  }

  await env.NOTES_DB
    .prepare('INSERT INTO users (telegram_id, state) VALUES (?, ?)')
    .bind(String(telegramId), 'idle')
    .run();

  const created = await env.NOTES_DB
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(String(telegramId))
    .first<DbUser>();

  await ensureDefaultCategories(env, created!.id);
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

// ─── Categories ──────────────────────────────────────────────────────────────

export async function ensureDefaultCategories(env: Env, userId: number): Promise<void> {
  const count = await env.NOTES_DB
    .prepare('SELECT COUNT(*) as cnt FROM categories WHERE user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>();

  if ((count?.cnt ?? 0) > 0) return;

  const stmts = SYSTEM_CATEGORIES.map((category) =>
    env.NOTES_DB
      .prepare(
        `INSERT INTO categories (user_id, slug, name, emoji, color, llm_hint, is_system, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .bind(
        userId,
        category.slug,
        category.name,
        category.emoji,
        category.color,
        category.llm_hint,
        category.sort_order
      )
  );

  await env.NOTES_DB.batch(stmts);
}

export async function getCategoriesByUserId(env: Env, userId: number): Promise<DbCategory[]> {
  await ensureDefaultCategories(env, userId);

  const result = await env.NOTES_DB
    .prepare(`
      SELECT c.*, COUNT(n.id) as note_count
      FROM categories c
      LEFT JOIN notes n ON n.user_id = c.user_id AND n.type = c.slug AND n.deleted_at IS NULL
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `)
    .bind(userId)
    .all<DbCategory>();

  return result.results;
}

export async function getCategoryById(
  env: Env,
  categoryId: number,
  userId: number
): Promise<DbCategory | null> {
  return env.NOTES_DB
    .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
    .bind(categoryId, userId)
    .first<DbCategory>();
}

export async function getCategoryBySlug(
  env: Env,
  userId: number,
  slug: string
): Promise<DbCategory | null> {
  await ensureDefaultCategories(env, userId);
  return env.NOTES_DB
    .prepare('SELECT * FROM categories WHERE user_id = ? AND slug = ?')
    .bind(userId, slug)
    .first<DbCategory>();
}

export async function categorySlugExists(
  env: Env,
  userId: number,
  slug: string
): Promise<boolean> {
  const category = await getCategoryBySlug(env, userId, slug);
  return category !== null;
}

export async function createCategory(
  env: Env,
  userId: number,
  data: {
    slug: string;
    name: string;
    emoji: string;
    color: string;
    llm_hint?: string | null;
  }
): Promise<DbCategory> {
  const count = await env.NOTES_DB
    .prepare('SELECT COUNT(*) as cnt FROM categories WHERE user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>();

  if ((count?.cnt ?? 0) >= MAX_CATEGORIES_PER_USER) {
    throw new Error('category limit reached');
  }

  const maxOrder = await env.NOTES_DB
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM categories WHERE user_id = ?')
    .bind(userId)
    .first<{ max_order: number }>();

  await env.NOTES_DB
    .prepare(
      `INSERT INTO categories (user_id, slug, name, emoji, color, llm_hint, is_system, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .bind(
      userId,
      data.slug,
      data.name,
      data.emoji,
      data.color,
      data.llm_hint ?? null,
      (maxOrder?.max_order ?? -1) + 1
    )
    .run();

  return (await getCategoryBySlug(env, userId, data.slug))!;
}

export async function updateCategory(
  env: Env,
  categoryId: number,
  userId: number,
  fields: {
    name?: string;
    emoji?: string;
    color?: string;
    llm_hint?: string | null;
  }
): Promise<void> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (fields.name !== undefined) { sets.push('name = ?'); params.push(fields.name); }
  if (fields.emoji !== undefined) { sets.push('emoji = ?'); params.push(fields.emoji); }
  if (fields.color !== undefined) { sets.push('color = ?'); params.push(fields.color); }
  if ('llm_hint' in fields) { sets.push('llm_hint = ?'); params.push(fields.llm_hint ?? null); }

  if (sets.length === 0) return;

  params.push(categoryId, userId);
  await env.NOTES_DB
    .prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...params)
    .run();
}

export async function deleteCategory(
  env: Env,
  categoryId: number,
  userId: number
): Promise<void> {
  const category = await getCategoryById(env, categoryId, userId);
  if (!category || category.is_system === 1) {
    throw new Error('cannot delete system category');
  }

  await env.NOTES_DB.batch([
    env.NOTES_DB
      .prepare('UPDATE notes SET type = ? WHERE user_id = ? AND type = ?')
      .bind(DEFAULT_CATEGORY_SLUG, userId, category.slug),
    env.NOTES_DB
      .prepare('UPDATE folders SET category = NULL WHERE user_id = ? AND category = ?')
      .bind(userId, category.slug),
    env.NOTES_DB
      .prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
      .bind(categoryId, userId),
  ]);
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export async function claimUpdateId(env: Env, updateId: number): Promise<boolean> {
  try {
    const result = await env.NOTES_DB
      .prepare('INSERT OR IGNORE INTO processed_updates (update_id) VALUES (?)')
      .bind(updateId)
      .run();

    return result.meta.changes > 0;
  } catch {
    // Allow processing when migrations are not yet applied.
    return true;
  }
}

export async function createFolder(
  env: Env,
  userId: number,
  name: string,
  category?: string | null
): Promise<DbFolder> {
  const count = await env.NOTES_DB
    .prepare('SELECT COUNT(*) as cnt FROM folders WHERE user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>();

  const sortOrder = (count?.cnt ?? 0);

  await env.NOTES_DB
    .prepare('INSERT INTO folders (user_id, name, category, sort_order) VALUES (?, ?, ?, ?)')
    .bind(userId, name, category ?? null, sortOrder)
    .run();

  const folder = await env.NOTES_DB
    .prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .bind(userId)
    .first<DbFolder>();

  return folder!;
}

export async function getFoldersByUserId(env: Env, userId: number): Promise<DbFolder[]> {
  const result = await env.NOTES_DB
    .prepare(`
      SELECT f.*, COUNT(n.id) as note_count
      FROM folders f
      LEFT JOIN notes n ON n.folder_id = f.id AND n.deleted_at IS NULL
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY f.sort_order ASC, f.id ASC
    `)
    .bind(userId)
    .all<DbFolder>();

  return result.results;
}

export async function getUncategorizedCount(env: Env, userId: number): Promise<number> {
  const row = await env.NOTES_DB
    .prepare('SELECT COUNT(*) as cnt FROM notes WHERE user_id = ? AND folder_id IS NULL AND deleted_at IS NULL')
    .bind(userId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function getFolderById(env: Env, folderId: number, userId: number): Promise<DbFolder | null> {
  return env.NOTES_DB
    .prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
    .bind(folderId, userId)
    .first<DbFolder>();
}

export async function updateFolder(
  env: Env,
  folderId: number,
  userId: number,
  name: string,
  category?: string | null
): Promise<void> {
  if (category !== undefined) {
    await env.NOTES_DB
      .prepare('UPDATE folders SET name = ?, category = ? WHERE id = ? AND user_id = ?')
      .bind(name, category, folderId, userId)
      .run();
    return;
  }

  await env.NOTES_DB
    .prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?')
    .bind(name, folderId, userId)
    .run();
}

export async function deleteFolder(env: Env, folderId: number, userId: number): Promise<void> {
  await env.NOTES_DB.batch([
    env.NOTES_DB
      .prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ? AND user_id = ?')
      .bind(folderId, userId),
    env.NOTES_DB
      .prepare('DELETE FROM folders WHERE id = ? AND user_id = ?')
      .bind(folderId, userId),
  ]);
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
  tags: string[] = [],
  folderId?: number | null
): Promise<DbNote> {
  const tagsJson = JSON.stringify(tags);
  const tagsForFts = tags.join(' ');

  const [insertResult] = await env.NOTES_DB.batch([
    env.NOTES_DB
      .prepare('INSERT INTO notes (user_id, folder_id, type, text, tags) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, folderId ?? null, type, text, tagsJson),
    env.NOTES_DB
      .prepare('INSERT INTO notes_fts(rowid, text, tags) VALUES (last_insert_rowid(), ?, ?)')
      .bind(text, tagsForFts),
  ]);

  const noteId = insertResult.meta.last_row_id;
  const note = await env.NOTES_DB
    .prepare('SELECT * FROM notes WHERE id = ?')
    .bind(noteId)
    .first<DbNote>();

  return note!;
}

export async function getNotesByUserId(
  env: Env,
  userId: number,
  type?: string,
  folderId?: number,
  tag?: string,
  limit = 50,
  offset = 0,
  trash = false
): Promise<DbNote[]> {
  let query = 'SELECT * FROM notes WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (trash) {
    query += ' AND deleted_at IS NOT NULL';
  } else {
    query += ' AND deleted_at IS NULL';
  }

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (folderId !== undefined) {
    query += ' AND folder_id = ?';
    params.push(folderId);
  }

  if (tag) {
    query += ' AND EXISTS (SELECT 1 FROM json_each(notes.tags) WHERE value = ?)';
    params.push(tag.toLowerCase());
  }

  query += trash
    ? ' ORDER BY deleted_at DESC LIMIT ? OFFSET ?'
    : ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.NOTES_DB
    .prepare(query)
    .bind(...params)
    .all<DbNote>();

  return result.results;
}

export async function searchNotes(
  env: Env,
  userId: number,
  query: string
): Promise<DbNote[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  // Use FTS5 for full-text search
  const result = await env.NOTES_DB
    .prepare(`
      SELECT n.* FROM notes n
      JOIN notes_fts ON notes_fts.rowid = n.id
      WHERE notes_fts MATCH ? AND n.user_id = ? AND n.deleted_at IS NULL
      ORDER BY n.created_at DESC
      LIMIT 50
    `)
    .bind(ftsQuery, userId)
    .all<DbNote>();

  return result.results;
}

export function buildFtsQuery(query: string): string {
  const terms = query.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return terms
    .slice(0, 10)
    .map(term => `"${term.replaceAll('"', '""')}"*`)
    .join(' AND ');
}

export async function getUserTags(env: Env, userId: number): Promise<string[]> {
  const notes = await env.NOTES_DB
    .prepare('SELECT tags FROM notes WHERE user_id = ? AND deleted_at IS NULL AND tags != ? AND tags != ?')
    .bind(userId, '[]', '')
    .all<{ tags: string }>();

  const tagSet = new Set<string>();
  for (const row of notes.results) {
    try {
      const tags = JSON.parse(row.tags) as string[];
      tags.forEach(t => tagSet.add(t));
    } catch { /* skip */ }
  }

  return [...tagSet].sort();
}

export async function getNoteById(
  env: Env,
  noteId: number,
  userId: number,
  options?: { includeDeleted?: boolean }
): Promise<DbNote | null> {
  let query = 'SELECT * FROM notes WHERE id = ? AND user_id = ?';
  if (!options?.includeDeleted) {
    query += ' AND deleted_at IS NULL';
  }
  return env.NOTES_DB
    .prepare(query)
    .bind(noteId, userId)
    .first<DbNote>();
}

export async function updateNote(
  env: Env,
  noteId: number,
  userId: number,
  fields: {
    text?: string;
    done?: number;
    folder_id?: number | null;
    tags?: string[];
    type?: string;
    remind_at?: string | null;
  }
): Promise<void> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (fields.text !== undefined) { sets.push('text = ?'); params.push(fields.text); }
  if (fields.done !== undefined) { sets.push('done = ?'); params.push(fields.done); }
  if ('folder_id' in fields) { sets.push('folder_id = ?'); params.push(fields.folder_id ?? null); }
  if (fields.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(fields.tags)); }
  if (fields.type !== undefined) { sets.push('type = ?'); params.push(fields.type); }
  if ('remind_at' in fields) { sets.push('remind_at = ?'); params.push(fields.remind_at ?? null); }

  if (sets.length === 0) return;

  const needsFtsUpdate = fields.text !== undefined || fields.tags !== undefined;

  if (needsFtsUpdate) {
    const note = await getNoteById(env, noteId, userId);
    if (!note) return;

    const nextText = fields.text ?? note.text;
    const nextTags = fields.tags ?? (JSON.parse(note.tags || '[]') as string[]);
    const nextTagsForFts = nextTags.join(' ');

    params.push(noteId, userId);
    await env.NOTES_DB.batch([
      env.NOTES_DB
        .prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...params),
      env.NOTES_DB
        .prepare('DELETE FROM notes_fts WHERE rowid = ?')
        .bind(noteId),
      env.NOTES_DB
        .prepare('INSERT INTO notes_fts(rowid, text, tags) VALUES (?, ?, ?)')
        .bind(noteId, nextText, nextTagsForFts),
    ]);
    return;
  }

  params.push(noteId, userId);
  await env.NOTES_DB
    .prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...params)
    .run();
}

export async function cleanupProcessedUpdates(
  env: Env,
  retentionDays = 7
): Promise<number> {
  const result = await env.NOTES_DB
    .prepare(
      `DELETE FROM processed_updates
       WHERE processed_at < datetime('now', ?)`
    )
    .bind(`-${retentionDays} days`)
    .run();

  return result.meta.changes ?? 0;
}

async function removeNoteFromFts(env: Env, noteId: number): Promise<void> {
  try {
    await env.NOTES_DB
      .prepare('DELETE FROM notes_fts WHERE rowid = ?')
      .bind(noteId)
      .run();
  } catch {
    // Ignore FTS cleanup errors (row may already be absent).
  }
}

async function upsertNoteInFts(env: Env, noteId: number, text: string, tagsForFts: string): Promise<void> {
  await removeNoteFromFts(env, noteId);
  await env.NOTES_DB
    .prepare('INSERT INTO notes_fts(rowid, text, tags) VALUES (?, ?, ?)')
    .bind(noteId, text, tagsForFts)
    .run();
}

export async function deleteNote(env: Env, noteId: number, userId: number): Promise<void> {
  await removeNoteFromFts(env, noteId);
  await env.NOTES_DB
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .run();
}

export async function softDeleteNote(env: Env, noteId: number, userId: number): Promise<void> {
  await env.NOTES_DB
    .prepare(`UPDATE notes SET deleted_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(noteId, userId)
    .run();
  await removeNoteFromFts(env, noteId);
}

export async function restoreNote(env: Env, noteId: number, userId: number): Promise<void> {
  const note = await env.NOTES_DB
    .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL')
    .bind(noteId, userId)
    .first<DbNote>();

  if (!note) return;

  const tagsForFts = (JSON.parse(note.tags || '[]') as string[]).join(' ');

  await env.NOTES_DB
    .prepare('UPDATE notes SET deleted_at = NULL WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .run();

  await upsertNoteInFts(env, noteId, note.text, tagsForFts);
}

export async function purgeOldTrash(env: Env, retentionDays = 30): Promise<number> {
  const result = await env.NOTES_DB
    .prepare(
      `SELECT id, user_id FROM notes
       WHERE deleted_at IS NOT NULL
         AND deleted_at < datetime('now', ?)`
    )
    .bind(`-${retentionDays} days`)
    .all<{ id: number; user_id: number }>();

  for (const row of result.results) {
    await deleteNote(env, row.id, row.user_id);
  }

  return result.results.length;
}

export async function getDueReminders(env: Env, limit = 100): Promise<DueReminder[]> {
  const result = await env.NOTES_DB
    .prepare(
      `SELECT n.id as note_id, n.user_id, n.text, n.remind_at, u.telegram_id
       FROM notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.deleted_at IS NULL
         AND n.remind_at IS NOT NULL
         AND n.remind_at <= datetime('now')
       ORDER BY n.remind_at ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<DueReminder>();

  return result.results;
}

export async function clearReminder(env: Env, noteId: number, userId: number): Promise<void> {
  await env.NOTES_DB
    .prepare('UPDATE notes SET remind_at = NULL WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .run();
}

export async function getAllNotesForExport(env: Env, userId: number): Promise<DbNote[]> {
  const result = await env.NOTES_DB
    .prepare(
      `SELECT * FROM notes
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<DbNote>();

  return result.results;
}
