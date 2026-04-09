import type { Env, TelegramMessage, TelegramCallbackQuery } from '../types';
import { sendMessage, editMessageText, answerCallbackQuery } from './telegram';
import { onboardingChoiceKeyboard, onboardingDoneKeyboard } from './keyboard';
import { getOrCreateUser, updateUserState, createFolder, getFoldersByUserId } from '../db/queries';

const DEFAULT_FOLDERS = ['🚀 разработка', '🏠 дом', '🛒 покупки', '💡 идеи'];

// ─── /start ───────────────────────────────────────────────────────────────────

export async function handleStart(env: Env, msg: TelegramMessage): Promise<void> {
  if (!msg.from) return;

  const user = await getOrCreateUser(env, msg.from.id);
  await updateUserState(env, user.id, 'onboarding');

  const name = msg.from.first_name;

  const text =
    `👋 Привет, <b>${name}</b>! Я <b>AI Notes Bot</b> — твой умный блокнот прямо в Telegram.\n\n` +

    `<b>Как это работает:</b>\n\n` +

    `📝 <b>Текстовые заметки</b>\n` +
    `Просто напиши мне любую мысль или задачу:\n` +
    `<i>«Купить молоко, позвонить врачу, идея для проекта»</i>\n` +
    `Я сам разобью на части и классифицирую.\n\n` +

    `🎤 <b>Голосовые заметки</b>\n` +
    `Запиши голосовое — я распознаю речь и обработаю автоматически.\n\n` +

    `🏷 <b>Теги</b>\n` +
    `Добавляй хэштеги прямо в текст:\n` +
    `<i>«проверить деплой #работа #срочно»</i>\n\n` +

    `📂 <b>Папки</b>\n` +
    `Заметки распределяются по папкам. Управляй ими в Mini App.\n\n` +

    `📱 <b>Mini App</b>\n` +
    `Кнопка снизу → полный интерфейс: поиск, фильтры, редактирование.\n\n` +

    `─────────────────────\n` +
    `Начнём с настройки папок?`;

  await sendMessage(env, msg.chat.id, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🚀 Настроить папки', callback_data: 'onboarding_start' },
          { text: '⏭ Пропустить', callback_data: 'onboarding_skip' },
        ],
      ],
    },
  });
}

// ─── Callback Handler ─────────────────────────────────────────────────────────

export async function handleOnboardingCallback(
  env: Env,
  cbq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cbq.data ?? '';
  const chatId = cbq.message?.chat.id;
  const messageId = cbq.message?.message_id;
  const user = await getOrCreateUser(env, cbq.from.id);

  if (!chatId || !messageId) return false;

  // ── Показать выбор типа онбординга ──
  if (data === 'onboarding_start') {
    await answerCallbackQuery(env, cbq.id);
    await editMessageText(
      env, chatId, messageId,
      '📂 <b>Настройка папок</b>\n\n' +
      'Выбери, как создать папки:\n\n' +
      '⚡ <b>Быстро</b> — создам готовый набор:\n' +
      DEFAULT_FOLDERS.map(f => `  • ${f}`).join('\n') + '\n\n' +
      '✏️ <b>Вручную</b> — напишешь свои названия',
      { reply_markup: onboardingChoiceKeyboard() }
    );
    return true;
  }

  // ── Пропустить ──
  if (data === 'onboarding_skip') {
    await answerCallbackQuery(env, cbq.id);
    await updateUserState(env, user.id, 'idle');
    await editMessageText(
      env, chatId, messageId,
      '✅ <b>Готово!</b>\n\n' +
      'Отправь мне голосовое или текстовое сообщение — я запишу как заметку.\n\n' +
      '<i>Пример: «Купить хлеб и позвонить маме #дом»</i>'
    );
    return true;
  }

  // ── Быстрый онбординг ──
  if (data === 'onboarding_quick') {
    await answerCallbackQuery(env, cbq.id);

    for (const name of DEFAULT_FOLDERS) {
      await createFolder(env, user.id, name);
    }
    await updateUserState(env, user.id, 'idle');

    await editMessageText(
      env, chatId, messageId,
      '✅ <b>Папки созданы!</b>\n\n' +
      DEFAULT_FOLDERS.map(f => `📁 ${f}`).join('\n') +
      '\n\n' +
      '🎉 <b>Всё готово!</b> Попробуй прямо сейчас:\n\n' +
      '• Напиши любую мысль или задачу\n' +
      '• Запиши голосовое сообщение\n' +
      '• Открой Mini App кнопкой снизу для управления заметками\n\n' +
      '<i>Пример: «Купить молоко #дом, проверить сервер #работа»</i>'
    );
    return true;
  }

  // ── Ручной онбординг ──
  if (data === 'onboarding_manual') {
    await answerCallbackQuery(env, cbq.id);
    await updateUserState(env, user.id, 'onboarding_manual');
    await editMessageText(
      env, chatId, messageId,
      '✏️ <b>Создай свои папки</b>\n\n' +
      'Напиши название папки — я её создам.\n' +
      'Можно добавить несколько, по одной за раз.\n\n' +
      '<i>Например: работа, учёба, здоровье, путешествия</i>\n\n' +
      'Когда закончишь — нажми <b>Готово ✅</b>',
      { reply_markup: onboardingDoneKeyboard() }
    );
    return true;
  }

  // ── Завершить ручной онбординг ──
  if (data === 'onboarding_done') {
    await answerCallbackQuery(env, cbq.id);
    const folders = await getFoldersByUserId(env, user.id);
    await updateUserState(env, user.id, 'idle');

    const folderList = folders.length > 0
      ? folders.map(f => `📁 ${f.name}`).join('\n')
      : '(папки не созданы — можно добавить через Mini App)';

    await editMessageText(
      env, chatId, messageId,
      '✅ <b>Настройка завершена!</b>\n\n' +
      '<b>Твои папки:</b>\n' + folderList +
      '\n\n' +
      '🎉 Теперь пробуй:\n' +
      '• Напиши любую мысль или задачу\n' +
      '• Запиши голосовое сообщение\n' +
      '• Открой Mini App для управления заметками\n\n' +
      '<i>Пример: «Купить молоко #дом, проверить сервер #работа»</i>'
    );
    return true;
  }

  return false;
}

// ─── Folder Input (manual onboarding) ────────────────────────────────────────

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
  const folderList = folders.map(f => `📁 ${f.name}`).join('\n');

  await sendMessage(
    env, msg.chat.id,
    `✅ Папка <b>${name}</b> создана!\n\n` +
    `<b>Папки (${folders.length}):</b>\n${folderList}\n\n` +
    `Добавь ещё или нажми <b>Готово ✅</b>`,
    { reply_markup: onboardingDoneKeyboard() }
  );
}
