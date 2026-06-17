import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupDevPreview } from './dev/preview';
import './index.css';

setupDevPreview();

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const isDevPreview = import.meta.env.DEV && import.meta.env.VITE_DEV_PREVIEW === 'true';

if (!tg?.initData) {
  createRoot(root).render(
    <StrictMode>
      <div style={{ padding: 24, textAlign: 'center', maxWidth: 360, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 12 }}>AI Notes</h1>
        {isDevPreview ? (
          <>
            <p style={{ marginBottom: 16 }}>Режим веб-превью: нужна dev-авторизация.</p>
            <code style={{ display: 'block', fontSize: 13, opacity: 0.8 }}>
              cd miniapp && npm run gen:auth
            </code>
            <p style={{ marginTop: 16, fontSize: 14, opacity: 0.7 }}>
              Затем запусти API (<code>cd notes-bot && npm run dev</code>) и UI (<code>npm run dev:web</code>).
            </p>
          </>
        ) : (
          <p>Открой это приложение из Telegram-бота.</p>
        )}
      </div>
    </StrictMode>
  );
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}