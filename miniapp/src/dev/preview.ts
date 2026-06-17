/** Dark theme close to Telegram Mini App (used in browser dev preview). */
const DEV_THEME = {
  bg_color: '#1c1c1e',
  secondary_bg_color: '#2c2c2e',
  text_color: '#ffffff',
  hint_color: '#8e8e93',
  button_color: '#8b5cf6',
  button_text_color: '#ffffff',
} as const;

const THEME_CSS_MAP: Record<keyof typeof DEV_THEME, string> = {
  bg_color: '--tg-theme-bg-color',
  secondary_bg_color: '--tg-theme-secondary-bg-color',
  text_color: '--tg-theme-text-color',
  hint_color: '--tg-theme-hint-color',
  button_color: '--tg-theme-button-color',
  button_text_color: '--tg-theme-button-text-color',
};

function applyTelegramTheme(theme: typeof DEV_THEME): void {
  const root = document.documentElement;
  root.style.colorScheme = 'dark';
  for (const [key, cssVar] of Object.entries(THEME_CSS_MAP)) {
    root.style.setProperty(cssVar, theme[key as keyof typeof DEV_THEME]);
  }
}

/**
 * Browser dev preview — mocks Telegram WebApp so the Mini App runs outside Telegram.
 * Enable with VITE_DEV_PREVIEW=true in .env.development
 */
export function setupDevPreview(): boolean {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_DEV_PREVIEW !== 'true') return false;

  const initData = import.meta.env.VITE_DEV_INIT_DATA?.trim();
  if (!initData) {
    console.warn(
      '[dev preview] VITE_DEV_INIT_DATA is empty. Run: npm run gen:auth'
    );
    return false;
  }

  const userId = Number(import.meta.env.VITE_DEV_USER_ID ?? '123456789');
  const firstName = import.meta.env.VITE_DEV_USER_NAME ?? 'Dev User';

  applyTelegramTheme(DEV_THEME);

  window.Telegram = {
    WebApp: {
      ready: () => {},
      expand: () => {},
      initData,
      initDataUnsafe: {
        user: {
          id: Number.isFinite(userId) ? userId : 123456789,
          first_name: firstName,
          username: 'dev_user',
        },
      },
      colorScheme: 'dark',
      themeParams: { ...DEV_THEME },
      close: () => window.close(),
    },
  };

  document.documentElement.dataset.devPreview = 'true';
  return true;
}