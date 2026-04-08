import type { Env, TelegramUpdate } from './types';
import { handleMessage, handleCallbackQuery } from './bot/handlers';
import { handleNotesApi } from './api/notes';
import { handleFoldersApi } from './api/folders';
import { corsHeaders } from './api/auth';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── Telegram Webhook ──
    if (path === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    // ── REST API ──
    if (path.startsWith('/api/notes')) {
      return handleNotesApi(env, request, path);
    }

    if (path.startsWith('/api/folders')) {
      return handleFoldersApi(env, request, path);
    }

    // ── Static / root ──
    return new Response('AI Notes Bot is running', { status: 200 });
  },
};

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  let update: TelegramUpdate;

  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    if (update.message) {
      await handleMessage(env, update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(env, update.callback_query);
    }
  } catch (err) {
    // Log but always return 200 so Telegram doesn't retry
    console.error('Webhook handler error:', err);
  }

  return new Response('OK', { status: 200 });
}
