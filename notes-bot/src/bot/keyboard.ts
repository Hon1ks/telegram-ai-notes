// Inline keyboard builders for Telegram Bot

export function startKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🚀 Начать настройку', callback_data: 'onboarding_start' },
        { text: '⏭ Пропустить', callback_data: 'onboarding_skip' },
      ],
    ],
  };
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
