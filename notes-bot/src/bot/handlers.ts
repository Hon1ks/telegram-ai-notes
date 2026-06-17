import type { Env, TelegramMessage, TelegramCallbackQuery } from '../types';
import { sendMessage, sendChatAction, setChatMenuButton } from './telegram';
import { handleStart, handleOnboardingCallback, handleOnboardingFolderInput } from './onboarding';
import { transcribeVoice } from '../pipeline/stt';
import { getOrCreateUser, getFoldersByUserId } from '../db/queries';
import { escapeHtml } from './html';
import { sttConfirmKeyboard } from './keyboard';
import { setPendingStt } from './session';
import { handleNoteActionCallback } from './actions';
import { processTextNote } from './processNote';
import { errorKind, logError } from '../util/logger';

const MAX_VOICE_DURATION_SECONDS = 300;

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
      '• Голосовые: сначала покажу распознанный текст — подтверди сохранение\n' +
      '• После сохранения: «Отменить», «Переместить» или «Mini App»\n' +
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

    const messageId = await sendMessage(
      env,
      chatId,
      `🎤 <b>Распознано:</b>\n${escapeHtml(text)}\n\nСохранить заметку?`,
      { reply_markup: sttConfirmKeyboard() }
    );

    await setPendingStt(env, user.id, {
      text,
      chatId,
      messageId: messageId ?? 0,
    });
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
  if (await handleOnboardingCallback(env, cbq)) return;
  if (await handleNoteActionCallback(env, cbq)) return;

  const { answerCallbackQuery } = await import('./telegram');
  await answerCallbackQuery(env, cbq.id);
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