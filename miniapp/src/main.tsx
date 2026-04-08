import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize Telegram WebApp
window.Telegram?.WebApp?.ready();
window.Telegram?.WebApp?.expand();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
