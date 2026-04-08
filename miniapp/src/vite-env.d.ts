/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
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
