import type { Env, TelegramMessage, TelegramCallbackQuery, NoteItem } from '../types';
import { sendMessage, sendChatAction } from './telegram';
import { handleStart, handleOnboardingCallback, handleOnboardingFolderInput } from './onboarding';
import { cheapGuard, llmGuard } from '../pipeline/guard';
import { transcribeVoice } from '../pipeline/stt';
import { parseNotes } from '../pipeline/parser';
import { getOrCreateUser, createNote, getFoldersByUserId } from '../db/queries';

// ─── Category Labels ──────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  tasks: '✅ Задачи',
  ideas: '💡 Идеи',
  shopping: '🛒 Покупки',
  notes: '📝 Заметки',
};

// ─── Message Handler ──────────────────────────────────────────────────────────

export async function handleMessage(env: Env, msg: TelegramMessage): Promise<void> {
  if (!msg.from) return;

  const chatId = msg.chat.id;

  // /start command
  if (msg.text === '/start') {
    await handleStart(env, msg);
    return;
  }

  const user = await getOrCreateUser(env, msg.from.id);

  // Onboarding folder input mode
  if (user.state === 'onboarding_manual' && msg.text) {
    await handleOnboardingFolderInput(env, msg);
    return;
  }

  // Ignore during initial onboarding (user hasn't made a choice yet)
  if (user.state === 'onboarding') {
    return;
  }

  // ── Voice message ──
  if (msg.voice) {
    await sendChatAction(env, chatId, 'record_audio');

    let text: string;
    try {
      text = await transcribeVoice(env, msg.voice.file_id);
    } catch {
      await sendMessage(env, chatId, '❌ Не удалось распознать голосовое сообщение. Попробуй ещё раз.');
      return;
    }

    if (!text) {
      await sendMessage(env, chatId, '🤔 Не смог разобрать речь. Попробуй говорить чётче.');
      return;
    }

    await processTextNote(env, chatId, user.id, text);
    return;
  }

  // ── Text message ──
  if (msg.text) {
    await sendChatAction(env, chatId, 'typing');
    await processTextNote(env, chatId, user.id, msg.text);
    return;
  }
}

// ─── Callback Query Handler ───────────────────────────────────────────────────

export async function handleCallbackQuery(env: Env, cbq: TelegramCallbackQuery): Promise<void> {
  const handled = await handleOnboardingCallback(env, cbq);
  if (!handled) {
    // Unknown callback — just acknowledge
    const { answerCallbackQuery } = await import('./telegram');
    await answerCallbackQuery(env, cbq.id);
  }
}

// ─── Core Pipeline ────────────────────────────────────────────────────────────

async function processTextNote(
  env: Env,
  chatId: number,
  userId: number,
  text: string
): Promise<void> {
  // 1. Cheap guard
  if (!cheapGuard(text)) return;

  // 2. LLM guard
  const shouldProcess = await llmGuard(env, text);
  if (!shouldProcess) return;

  // 3. Parse & classify
  let items: NoteItem[];
  try {
    items = await parseNotes(env, text);
  } catch {
    await sendMessage(env, chatId, '❌ Ошибка обработки. Попробуй ещё раз.');
    return;
  }

  if (items.length === 0) return;

  // 4. Find appropriate folder for each item
  const folders = await getFoldersByUserId(env, userId);
  const folderMap = buildFolderMap(folders);

  // 5. Save to DB
  for (const item of items) {
    const folderId = folderMap[item.type] ?? null;
    await createNote(env, userId, item.type, item.text, folderId);
  }

  // 6. Build response
  const reply = formatResponse(items);
  await sendMessage(env, chatId, reply);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFolderMap(folders: Array<{ id: number; name: string }>): Record<string, number> {
  const map: Record<string, number> = {};
  for (const folder of folders) {
    const lower = folder.name.toLowerCase();
    if (lower.includes('покупк') || lower.includes('shop')) map['shopping'] = folder.id;
    else if (lower.includes('задач') || lower.includes('task')) map['tasks'] = folder.id;
    else if (lower.includes('иде') || lower.includes('idea')) map['ideas'] = folder.id;
    else if (!map['notes']) map['notes'] = folder.id;
  }
  return map;
}

function formatResponse(items: NoteItem[]): string {
  const grouped: Record<string, string[]> = {};

  for (const item of items) {
    const key = item.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item.text);
  }

  const lines: string[] = ['🧠 <b>Разобрал:</b>\n'];

  for (const [type, texts] of Object.entries(grouped)) {
    const label = CATEGORY_EMOJI[type] ?? `📌 ${type}`;
    lines.push(`<b>${label}:</b>`);
    for (const t of texts) {
      // Trim long notes
      const display = t.length > 200 ? t.slice(0, 197) + '...' : t;
      lines.push(`• ${display}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
