import type { Env, TelegramMessage, TelegramCallbackQuery, NoteItem, NoteType } from '../types';
import { sendMessage, sendChatAction, setChatMenuButton } from './telegram';
import { handleStart, handleOnboardingCallback, handleOnboardingFolderInput } from './onboarding';
import { cheapGuard, llmGuard } from '../pipeline/guard';
import { transcribeVoice } from '../pipeline/stt';
import { parseNotes } from '../pipeline/parser';
import { getOrCreateUser, createNote, getFoldersByUserId } from '../db/queries';
import { escapeHtml } from './html';
import { isNoteType } from '../api/validation';
import { errorKind, logError } from '../util/logger';

const MAX_VOICE_DURATION_SECONDS = 300;

const CATEGORY_EMOJI: Record<string, string> = {
  tasks: '✅ Задачи',
  ideas: '💡 Идеи',
  shopping: '🛒 Покупки',
  notes: '📝 Заметки',
};

export async function handleMessage(env: Env, msg: TelegramMessage): Promise<void> {
  if (!msg.from) return;

  const chatId = msg.chat.id;

  if (msg.text === '/start') {
    await handleStart(env, msg);
    return;
  }

  if (msg.text === '/help') {
    await sendMessage(
      env,
      chatId,
      '📖 <b>Справка</b>\n\n' +
      '• Напиши текст или запиши голосовое — я сохраню и классифицирую заметку\n' +
      '• Используй теги: <i>#работа #срочно</i>\n' +
      '• Команды: /start /help /app\n' +
      '• Mini App — полный интерфейс с поиском и папками'
    );
    return;
  }

  if (msg.text === '/app') {
    const url = env.MINIAPP_URL?.trim();
    if (url) {
      await sendMessage(env, chatId, `📱 Открой Mini App:\n${escapeHtml(url)}`);
    } else {
      await sendMessage(env, chatId, '📱 Mini App доступен через кнопку меню внизу чата.');
    }
    return;
  }

  if (msg.text === '/settings') {
    const user = await getOrCreateUser(env, msg.from.id);
    const folders = await getFoldersByUserId(env, user.id);
    await sendMessage(
      env,
      chatId,
      '⚙️ <b>Настройки</b>\n\n' +
      `Статус: <b>${escapeHtml(user.state)}</b>\n` +
      `Папок: <b>${folders.length}</b>\n\n` +
      'Управляй папками и заметками в Mini App.\n' +
      'Команды: /help /app'
    );
    return;
  }

  const user = await getOrCreateUser(env, msg.from.id);
  await ensureMenuButton(env, chatId);

  if (user.state === 'onboarding_manual' && msg.text) {
    await handleOnboardingFolderInput(env, msg);
    return;
  }

  if (user.state === 'onboarding') return;

  if (msg.voice) {
    if (msg.voice.duration > MAX_VOICE_DURATION_SECONDS) {
      await sendMessage(env, chatId, '❌ Голосовое сообщение слишком длинное. Максимум — 5 минут.');
      return;
    }

    await sendChatAction(env, chatId, 'record_audio');

    let text: string;
    try {
      text = await transcribeVoice(env, msg.voice.file_id);
    } catch (err) {
      logError('stt_failed', { kind: errorKind(err) });
      await sendMessage(env, chatId, '❌ Не удалось распознать голосовое сообщение. Попробуй ещё раз.');
      return;
    }

    if (!text) {
      await sendMessage(env, chatId, '🤔 Не смог разобрать речь. Говори чётче или попробуй написать текстом.');
      return;
    }

    await sendMessage(env, chatId, `🎤 <b>Распознано:</b>\n${escapeHtml(text)}`);
    await processTextNote(env, chatId, user.id, text);
    return;
  }

  if (msg.text) {
    await sendChatAction(env, chatId, 'typing');
    await processTextNote(env, chatId, user.id, msg.text);
    return;
  }

  await sendMessage(
    env,
    chatId,
    'ℹ️ Поддерживаются только текстовые и голосовые сообщения. Напиши заметку или запиши голосовое.'
  );
}

export async function handleCallbackQuery(env: Env, cbq: TelegramCallbackQuery): Promise<void> {
  const handled = await handleOnboardingCallback(env, cbq);
  if (!handled) {
    const { answerCallbackQuery } = await import('./telegram');
    await answerCallbackQuery(env, cbq.id);
  }
}

async function processTextNote(
  env: Env,
  chatId: number,
  userId: number,
  text: string
): Promise<void> {
  if (!cheapGuard(text)) {
    await sendMessage(
      env,
      chatId,
      '🤔 Сообщение слишком короткое или это команда. Напиши заметку подлиннее.'
    );
    return;
  }

  let shouldProcess = true;
  try {
    shouldProcess = await llmGuard(env, text);
  } catch (err) {
    logError('llm_guard_failed', { kind: errorKind(err) });
    await sendMessage(
      env,
      chatId,
      '⚠️ Сервис классификации временно недоступен. Попробуй ещё раз через минуту.'
    );
    return;
  }

  if (!shouldProcess) {
    await sendMessage(
      env,
      chatId,
      '💬 Похоже, это не заметка — я ничего не сохранил. Если нужно записать, напиши задачу или идею.'
    );
    return;
  }

  let items: NoteItem[];
  try {
    items = await parseNotes(env, text);
  } catch (err) {
    logError('parse_notes_failed', { kind: errorKind(err) });
    await sendMessage(env, chatId, '❌ Ошибка обработки. Попробуй ещё раз.');
    return;
  }

  if (items.length === 0) {
    await sendMessage(env, chatId, '🤔 Не удалось выделить заметки из сообщения.');
    return;
  }

  const folders = await getFoldersByUserId(env, userId);
  const folderMap = buildFolderMap(folders);

  try {
    for (const item of items) {
      const folderId = folderMap[item.type] ?? null;
      await createNote(env, userId, item.type, item.text, item.tags, folderId);
    }
  } catch (err) {
    logError('create_note_failed', { kind: errorKind(err) });
    await sendMessage(
      env,
      chatId,
      '⚠️ Не удалось сохранить заметку в базу. Попробуй ещё раз.'
    );
    return;
  }

  const reply = formatResponse(items);
  try {
    await sendMessage(env, chatId, reply);
  } catch (err) {
    logError('telegram_send_failed', { kind: errorKind(err) });
    await sendMessage(
      env,
      chatId,
      '✅ Заметка сохранена, но не удалось отправить подробный ответ.'
    );
  }
}

function buildFolderMap(
  folders: Array<{ id: number; name: string; category?: string | null }>
): Partial<Record<NoteType, number>> {
  const map: Partial<Record<NoteType, number>> = {};

  for (const folder of folders) {
    if (folder.category && isNoteType(folder.category)) {
      map[folder.category] = folder.id;
    }
  }

  for (const folder of folders) {
    if (folder.category) continue;
    const lower = folder.name.toLowerCase();
    if (lower.includes('покупк') || lower.includes('shop')) map.shopping = folder.id;
    else if (lower.includes('задач') || lower.includes('task')) map.tasks = folder.id;
    else if (lower.includes('иде') || lower.includes('idea')) map.ideas = folder.id;
    else if (!map.notes) map.notes = folder.id;
  }

  return map;
}

function formatResponse(items: NoteItem[]): string {
  const grouped: Record<string, NoteItem[]> = {};

  for (const item of items) {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  }

  const lines: string[] = ['🧠 <b>Разобрал:</b>\n'];

  for (const [type, noteItems] of Object.entries(grouped)) {
    const label = CATEGORY_EMOJI[type] ?? `📌 ${type}`;
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

async function ensureMenuButton(env: Env, chatId: number): Promise<void> {
  const url = env.MINIAPP_URL?.trim();
  if (!url) return;

  try {
    await setChatMenuButton(env, chatId, url);
  } catch {
    // Menu button is optional UX sugar.
  }
}