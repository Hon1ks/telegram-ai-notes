import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

if (!tg?.initData) {
  createRoot(root).render(
    <StrictMode>
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 12 }}>AI Notes</h1>
        <p>Открой это приложение из Telegram-бота.</p>
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