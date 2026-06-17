import type { Env, NoteItem, DbCategory } from '../types';
import { sendMessage } from './telegram';
import { cheapGuard, llmGuard } from '../pipeline/guard';
import { UsageCapExceeded } from '../util/usageCap';
import { parseNotes, extractTags } from '../pipeline/parser';
import {
  createNote,
  getFoldersByUserId,
  getCategoriesByUserId,
} from '../db/queries';
import { escapeHtml } from './html';
import { DEFAULT_CATEGORY_SLUG } from '../categories/defaults';
import { afterSaveKeyboard } from './keyboard';
import { errorKind, logError } from '../util/logger';

export interface ProcessNoteResult {
  noteIds: number[];
  items: NoteItem[];
  usedFallback: boolean;
}

export async function processTextNote(
  env: Env,
  chatId: number,
  userId: number,
  text: string
): Promise<ProcessNoteResult | null> {
  if (!cheapGuard(text)) {
    await sendMessage(
      env,
      chatId,
      '🤔 Сообщение слишком короткое или это команда. Напиши заметку подлиннее.'
    );
    return null;
  }

  let shouldProcess = true;
  let guardUnavailable = false;
  let capExceeded = false;
  try {
    shouldProcess = await llmGuard(env, text, userId);
  } catch (err) {
    if (err instanceof UsageCapExceeded) {
      capExceeded = true;
      shouldProcess = true;
    } else {
      logError('llm_guard_failed', { kind: errorKind(err) });
      guardUnavailable = true;
      shouldProcess = true;
    }
  }

  if (!shouldProcess) {
    await sendMessage(
      env,
      chatId,
      '💬 Похоже, это не заметка — я ничего не сохранил. Если нужно записать, напиши задачу или идею.'
    );
    return null;
  }

  let items: NoteItem[];
  let usedFallback = guardUnavailable || capExceeded;
  try {
    items = await parseNotes(env, userId, text);
    if (items.length === 0) {
      usedFallback = true;
      items = buildFallbackItems(text);
    }
  } catch (err) {
    if (err instanceof UsageCapExceeded) {
      capExceeded = true;
      usedFallback = true;
      items = buildFallbackItems(text);
    } else {
      logError('parse_notes_failed', { kind: errorKind(err) });
      usedFallback = true;
      items = buildFallbackItems(text);
    }
  }

  const [folders, categories] = await Promise.all([
    getFoldersByUserId(env, userId),
    getCategoriesByUserId(env, userId),
  ]);
  const folderMap = buildFolderMap(folders, categories);

  const noteIds: number[] = [];
  try {
    for (const item of items) {
      const folderId = folderMap[item.type] ?? null;
      const note = await createNote(env, userId, item.type, item.text, item.tags, folderId);
      noteIds.push(note.id);
    }
  } catch (err) {
    logError('create_note_failed', { kind: errorKind(err) });
    await sendMessage(
      env,
      chatId,
      '⚠️ Не удалось сохранить заметку в базу. Попробуй ещё раз.'
    );
    return null;
  }

  let reply = formatResponse(items, categories);
  if (capExceeded) {
    reply += '\n\n⚠️ <i>Дневной лимит AI-обработки исчерпан — сохранил как обычную заметку.</i>';
  } else if (usedFallback) {
    reply +=
      '\n\n⚠️ <i>Классификация временно недоступна — сохранил как обычную заметку.</i>';
  }

  try {
    await sendMessage(env, chatId, reply, {
      reply_markup: afterSaveKeyboard(noteIds, env.MINIAPP_URL),
    });
  } catch (err) {
    logError('telegram_send_failed', { kind: errorKind(err) });
    await sendMessage(
      env,
      chatId,
      '✅ Заметка сохранена, но не удалось отправить подробный ответ.'
    );
  }

  return { noteIds, items, usedFallback };
}

function buildFallbackItems(text: string): NoteItem[] {
  return [{
    text,
    type: DEFAULT_CATEGORY_SLUG,
    category: DEFAULT_CATEGORY_SLUG,
    tags: extractTags(text),
  }];
}

function buildFolderMap(
  folders: Array<{ id: number; name: string; category?: string | null }>,
  categories: DbCategory[]
): Record<string, number> {
  const map: Record<string, number> = {};
  const knownSlugs = new Set(categories.map((category) => category.slug));

  for (const folder of folders) {
    if (folder.category && knownSlugs.has(folder.category) && map[folder.category] === undefined) {
      map[folder.category] = folder.id;
    }
  }

  return map;
}

function formatResponse(items: NoteItem[], categories: DbCategory[]): string {
  const grouped: Record<string, NoteItem[]> = {};

  for (const item of items) {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  }

  const lines: string[] = ['🧠 <b>Разобрал:</b>\n'];
  const categoryMap = new Map(categories.map((category) => [category.slug, category]));

  for (const [type, noteItems] of Object.entries(grouped)) {
    const category = categoryMap.get(type);
    const label = category
      ? `${category.emoji} ${category.name}`
      : `📌 ${type}`;
    lines.push(`<b>${label}:</b>`);
    for (const item of noteItems) {
      const display = item.text.length > 200 ? item.text.slice(0, 197) + '...' : item.text;
      const tagStr = item.tags.length > 0
        ? `  <i>${item.tags.map(escapeHtml).join(' ')}</i>`
        : '';
      lines.push(`• ${escapeHtml(display)}${tagStr}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}