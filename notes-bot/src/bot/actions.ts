import type { Env, TelegramCallbackQuery } from '../types';
import {
  answerCallbackQuery,
  editMessageText,
} from './telegram';
import {
  categoryMoveKeyboard,
  folderMoveKeyboard,
} from './keyboard';
import {
  getOrCreateUser,
  deleteNote,
  getNoteById,
  updateNote,
  getFoldersByUserId,
  getCategoriesByUserId,
} from '../db/queries';
import { clearPendingStt, getPendingStt } from './session';
import { escapeHtml } from './html';
import { processTextNote } from './processNote';

export async function handleNoteActionCallback(
  env: Env,
  cbq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cbq.data ?? '';
  const chatId = cbq.message?.chat.id;
  const messageId = cbq.message?.message_id;

  if (!chatId || !messageId) return false;

  if (data.startsWith('stt:')) {
    await handleSttCallback(env, cbq, data, chatId, messageId);
    return true;
  }

  if (data.startsWith('undo:')) {
    await handleUndoCallback(env, cbq, data, chatId, messageId);
    return true;
  }

  if (data.startsWith('mov:')) {
    await handleMoveCallback(env, cbq, data, chatId, messageId);
    return true;
  }

  if (data.startsWith('mvc:')) {
    await handleMoveCategoryCallback(env, cbq, data, chatId, messageId);
    return true;
  }

  if (data.startsWith('mvf:')) {
    await handleMoveFolderCallback(env, cbq, data, chatId, messageId);
    return true;
  }

  return false;
}

async function handleSttCallback(
  env: Env,
  cbq: TelegramCallbackQuery,
  data: string,
  chatId: number,
  messageId: number
): Promise<void> {
  const user = await getOrCreateUser(env, cbq.from.id);
  const pending = await getPendingStt(env, user.id);

  if (!pending || pending.chatId !== chatId) {
    await answerCallbackQuery(env, cbq.id, 'Сессия истекла — запиши голосовое заново');
    return;
  }

  if (data === 'stt:cancel') {
    await clearPendingStt(env, user.id);
    await answerCallbackQuery(env, cbq.id, 'Отменено');
    await editMessageText(
      env,
      chatId,
      messageId,
      `🎤 <b>Распознано:</b>\n${escapeHtml(pending.text)}\n\n<i>❌ Сохранение отменено</i>`,
    );
    return;
  }

  if (data === 'stt:ok') {
    await clearPendingStt(env, user.id);
    await answerCallbackQuery(env, cbq.id, 'Сохраняю...');

    const result = await processTextNote(env, chatId, user.id, pending.text);
    if (!result) {
      await editMessageText(
        env,
        chatId,
        messageId,
        `🎤 <b>Распознано:</b>\n${escapeHtml(pending.text)}\n\n<i>⚠️ Не удалось сохранить</i>`,
      );
      return;
    }

    await editMessageText(
      env,
      chatId,
      messageId,
      `🎤 <b>Распознано:</b>\n${escapeHtml(pending.text)}\n\n✅ <i>Сохранено</i>`,
    );
    return;
  }

  await answerCallbackQuery(env, cbq.id);
}

async function handleUndoCallback(
  env: Env,
  cbq: TelegramCallbackQuery,
  data: string,
  chatId: number,
  messageId: number
): Promise<void> {
  const user = await getOrCreateUser(env, cbq.from.id);
  const idsRaw = data.slice('undo:'.length);
  const noteIds = idsRaw
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (noteIds.length === 0) {
    await answerCallbackQuery(env, cbq.id, 'Нечего отменять');
    return;
  }

  let deleted = 0;
  for (const noteId of noteIds) {
    const note = await getNoteById(env, noteId, user.id);
    if (note) {
      await deleteNote(env, noteId, user.id);
      deleted += 1;
    }
  }

  if (deleted === 0) {
    await answerCallbackQuery(env, cbq.id, 'Заметки уже удалены');
    return;
  }

  await answerCallbackQuery(env, cbq.id, 'Сохранение отменено');
  await editMessageText(
    env,
    chatId,
    messageId,
    `<i>↩️ Сохранение отменено (${deleted})</i>`,
    { reply_markup: { inline_keyboard: [] } },
  );
}

async function handleMoveCallback(
  env: Env,
  cbq: TelegramCallbackQuery,
  data: string,
  chatId: number,
  messageId: number
): Promise<void> {
  if (data === 'mov:close') {
    await answerCallbackQuery(env, cbq.id);
    await editMessageText(env, chatId, messageId, cbq.message?.text ?? 'Готово');
    return;
  }

  const noteId = Number(data.slice('mov:'.length));
  if (!Number.isInteger(noteId) || noteId <= 0) {
    await answerCallbackQuery(env, cbq.id, 'Некорректная заметка');
    return;
  }

  const user = await getOrCreateUser(env, cbq.from.id);
  const note = await getNoteById(env, noteId, user.id);
  if (!note) {
    await answerCallbackQuery(env, cbq.id, 'Заметка не найдена');
    return;
  }

  const categories = await getCategoriesByUserId(env, user.id);
  await answerCallbackQuery(env, cbq.id);
  await editMessageText(
    env,
    chatId,
    messageId,
    `📂 <b>Выбери категорию</b>\n\n${escapeHtml(note.text.slice(0, 120))}`,
    { reply_markup: categoryMoveKeyboard(noteId, categories) },
  );
}

async function handleMoveCategoryCallback(
  env: Env,
  cbq: TelegramCallbackQuery,
  data: string,
  chatId: number,
  messageId: number
): Promise<void> {
  const match = data.match(/^mvc:(\d+):(.+)$/);
  if (!match) {
    await answerCallbackQuery(env, cbq.id, 'Некорректный запрос');
    return;
  }

  const noteId = Number(match[1]);
  const categorySlug = match[2];
  const user = await getOrCreateUser(env, cbq.from.id);
  const note = await getNoteById(env, noteId, user.id);
  if (!note) {
    await answerCallbackQuery(env, cbq.id, 'Заметка не найдена');
    return;
  }

  const categories = await getCategoriesByUserId(env, user.id);
  if (!categories.some((c) => c.slug === categorySlug)) {
    await answerCallbackQuery(env, cbq.id, 'Неизвестная категория');
    return;
  }

  await updateNote(env, noteId, user.id, { type: categorySlug });
  const folders = await getFoldersByUserId(env, user.id);
  const category = categories.find((c) => c.slug === categorySlug);

  await answerCallbackQuery(env, cbq.id, `Категория: ${category?.name ?? categorySlug}`);
  await editMessageText(
    env,
    chatId,
    messageId,
    `📂 <b>Выбери папку</b> · ${category?.emoji ?? '📌'} ${escapeHtml(category?.name ?? categorySlug)}\n\n${escapeHtml(note.text.slice(0, 120))}`,
    { reply_markup: folderMoveKeyboard(noteId, folders, categorySlug) },
  );
}

async function handleMoveFolderCallback(
  env: Env,
  cbq: TelegramCallbackQuery,
  data: string,
  chatId: number,
  messageId: number
): Promise<void> {
  const match = data.match(/^mvf:(\d+):(.+)$/);
  if (!match) {
    await answerCallbackQuery(env, cbq.id, 'Некорректный запрос');
    return;
  }

  const noteId = Number(match[1]);
  const folderToken = match[2];
  const user = await getOrCreateUser(env, cbq.from.id);
  const note = await getNoteById(env, noteId, user.id);
  if (!note) {
    await answerCallbackQuery(env, cbq.id, 'Заметка не найдена');
    return;
  }

  let folderId: number | null = null;
  if (folderToken !== 'none') {
    folderId = Number(folderToken);
    if (!Number.isInteger(folderId) || folderId <= 0) {
      await answerCallbackQuery(env, cbq.id, 'Некорректная папка');
      return;
    }
    const folders = await getFoldersByUserId(env, user.id);
    if (!folders.some((f) => f.id === folderId)) {
      await answerCallbackQuery(env, cbq.id, 'Папка не найдена');
      return;
    }
  }

  await updateNote(env, noteId, user.id, { folder_id: folderId });
  await answerCallbackQuery(env, cbq.id, folderId ? 'Перемещено в папку' : 'Без папки');
  await editMessageText(
    env,
    chatId,
    messageId,
    `✅ <b>Заметка обновлена</b>\n\n${escapeHtml(note.text.slice(0, 200))}`,
  );
}