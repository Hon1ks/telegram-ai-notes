/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEV_PREVIEW?: string;
  readonly VITE_DEV_INIT_DATA?: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_DEV_USER_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Telegram WebApp global
interface Window {
  Telegram?: {
    WebApp: {
      ready: () => void;
      expand: () => void;
      initData: string;
      initDataUnsafe: {
        user?: {
          id: number;
          first_name: string;
          username?: string;
        };
      };
      colorScheme: 'light' | 'dark';
      themeParams: Record<string, string>;
      close: () => void;
    };
  };
}
