import type { DbCategory } from '../types';

const MAX_CALLBACK_BYTES = 64;

function fitCallback(data: string): string {
  return data.length <= MAX_CALLBACK_BYTES ? data : data.slice(0, MAX_CALLBACK_BYTES);
}

export function sttConfirmKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅ Сохранить', callback_data: 'stt:ok' },
        { text: '❌ Отменить', callback_data: 'stt:cancel' },
      ],
    ],
  };
}

type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };

export function afterSaveKeyboard(noteIds: number[], miniappUrl?: string) {
  const rows: InlineButton[][] = [];

  if (noteIds.length > 0) {
    rows.push([{ text: '↩️ Отменить', callback_data: fitCallback(`undo:${noteIds.join(',')}`) }]);
  }

  if (noteIds.length === 1) {
    rows.push([{ text: '📂 Переместить', callback_data: `mov:${noteIds[0]}` }]);
  }

  if (miniappUrl?.trim()) {
    rows.push([{ text: '📱 Mini App', web_app: { url: miniappUrl.trim() } }]);
  }

  return { inline_keyboard: rows };
}

export function categoryMoveKeyboard(noteId: number, categories: DbCategory[]) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const category of categories.slice(0, 20)) {
    rows.push([{
      text: `${category.emoji} ${category.name}`,
      callback_data: fitCallback(`mvc:${noteId}:${category.slug}`),
    }]);
  }

  rows.push([{ text: '✕ Закрыть', callback_data: 'mov:close' }]);

  return { inline_keyboard: rows };
}

export function folderMoveKeyboard(
  noteId: number,
  folders: Array<{ id: number; name: string; category?: string | null }>,
  categorySlug: string
) {
  const matching = folders.filter(f => f.category === categorySlug || !f.category);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '📥 Без папки', callback_data: `mvf:${noteId}:none` }],
  ];

  for (const folder of matching.slice(0, 15)) {
    rows.push([{
      text: folder.name,
      callback_data: fitCallback(`mvf:${noteId}:${folder.id}`),
    }]);
  }

  rows.push([{ text: '← К категориям', callback_data: `mov:${noteId}` }]);

  return { inline_keyboard: rows };
}

export function onboardingChoiceKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '⚡ Быстрая настройка (рекомендуется)', callback_data: 'onboarding_quick' }],
      [{ text: '✏️ Создать свои папки', callback_data: 'onboarding_manual' }],
    ],
  };
}

export function onboardingDoneKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '✅ Готово', callback_data: 'onboarding_done' }],
    ],
  };
}