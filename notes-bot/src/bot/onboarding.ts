import type { Env, TelegramMessage, TelegramCallbackQuery } from '../types';
import { sendMessage, editMessageText, answerCallbackQuery } from './telegram';
import { onboardingChoiceKeyboard, onboardingDoneKeyboard } from './keyboard';
import { getOrCreateUser, updateUserState, createFolder, getFoldersByUserId } from '../db/queries';

const DEFAULT_FOLDERS = ['разработка', 'дом', 'покупки', 'личное'];

/**
 * Handles /start command — greets user and shows setup options.
 */
export async function handleStart(env: Env, msg: TelegramMessage): Promise<void> {
  if (!msg.from) return;

  const user = await getOrCreateUser(env, msg.from.id);
  await updateUserState(env, user.id, 'onboarding');

  const name = msg.from.first_name;
  const text = `👋 Привет, <b>${name}</b>!\n\n` +
    `Я <b>AI Notes Bot</b> — умный помощник для заметок.\n\n` +
    `✨ <b>Что я умею:</b>\n` +
    `• 🎤 Принимать голосовые заметки\n` +
    `• 📝 Обрабатывать текстовые заметки\n` +
    `• 🧠 Автоматически классифицировать по категориям\n` +
    `• 📂 Хранить в папках\n\n` +
    `Хочешь настроить папки?`;

  await sendMessage(env, msg.chat.id, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🚀 Начать настройку', callback_data: 'onboarding_start' },
          { text: '⏭ Пропустить', callback_data: 'onboarding_skip' },
        ],
      ],
    },
  });
}

/**
 * Handles all onboarding-related callback queries.
 */
export async function handleOnboardingCallback(
  env: Env,
  cbq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cbq.data ?? '';
  const chatId = cbq.message?.chat.id;
  const messageId = cbq.message?.message_id;
  const user = await getOrCreateUser(env, cbq.from.id);

  if (!chatId || !messageId) return false;

  if (data === 'onboarding_start') {
    await answerCallbackQuery(env, cbq.id);
    await editMessageText(
      env, chatId, messageId,
      '📂 <b>Настройка папок</b>\n\nКак хочешь создать папки?',
      { reply_markup: onboardingChoiceKeyboard() }
    );
    return true;
  }

  if (data === 'onboarding_skip') {
    await answerCallbackQuery(env, cbq.id);
    await updateUserState(env, user.id, 'idle');
    await editMessageText(env, chatId, messageId, '✅ Отлично! Отправь голосовое или текстовое сообщение — я запишу его как заметку.');
    return true;
  }

  if (data === 'onboarding_quick') {
    await answerCallbackQuery(env, cbq.id);

    for (const name of DEFAULT_FOLDERS) {
      await createFolder(env, user.id, name);
    }

    await updateUserState(env, user.id, 'idle');
    await editMessageText(
      env, chatId, messageId,
      '✅ <b>Папки созданы:</b>\n' + DEFAULT_FOLDERS.map(f => `• ${f}`).join('\n') +
      '\n\nТеперь отправь голосовое или текстовое сообщение — я разберу его на заметки!'
    );
    return true;
  }

  if (data === 'onboarding_manual') {
    await answerCallbackQuery(env, cbq.id);
    await updateUserState(env, user.id, 'onboarding_manual');
    await editMessageText(
      env, chatId, messageId,
      '✏️ <b>Создание своих папок</b>\n\nНапиши название папки. Можно добавить несколько.\nКогда закончишь — нажми <b>Готово</b>.',
      { reply_markup: onboardingDoneKeyboard() }
    );
    return true;
  }

  if (data === 'onboarding_done') {
    await answerCallbackQuery(env, cbq.id);
    const folders = await getFoldersByUserId(env, user.id);
    await updateUserState(env, user.id, 'idle');

    const folderList = folders.length > 0
      ? folders.map(f => `• ${f.name}`).join('\n')
      : '• (папки не созданы)';

    await editMessageText(
      env, chatId, messageId,
      `✅ <b>Настройка завершена!</b>\n\n<b>Твои папки:</b>\n${folderList}\n\nТеперь отправь голосовое или текстовое сообщение!`
    );
    return true;
  }

  return false;
}

/**
 * Handles text messages during manual onboarding (folder name input).
 */
export async function handleOnboardingFolderInput(
  env: Env,
  msg: TelegramMessage
): Promise<void> {
  if (!msg.from || !msg.text) return;

  const user = await getOrCreateUser(env, msg.from.id);
  const name = msg.text.trim().slice(0, 50);

  if (!name) return;

  await createFolder(env, user.id, name);
  const folders = await getFoldersByUserId(env, user.id);

  const folderList = folders.map(f => `• ${f.name}`).join('\n');

  await sendMessage(
    env, msg.chat.id,
    `✅ Папка <b>${name}</b> добавлена!\n\n<b>Папки:</b>\n${folderList}\n\nДобавь ещё или нажми <b>Готово</b>.`,
    { reply_markup: onboardingDoneKeyboard() }
  );
}
