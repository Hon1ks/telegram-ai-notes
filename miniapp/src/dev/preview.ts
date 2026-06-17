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
      themeParams: {
        bg_color: '#1c1c1e',
        text_color: '#ffffff',
        hint_color: '#8e8e93',
        button_color: '#8b5cf6',
        button_text_color: '#ffffff',
      },
      close: () => window.close(),
    },
  };

  document.documentElement.dataset.devPreview = 'true';
  return true;
}