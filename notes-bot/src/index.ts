import type { Env, TelegramUpdate } from './types';
import { handleMessage, handleCallbackQuery } from './bot/handlers';
import { handleNotesApi } from './api/notes';
import { handleFoldersApi } from './api/folders';
import { corsHeaders, errorResponse } from './api/auth';
import { sendMessage } from './bot/telegram';
import { claimUpdateId, cleanupProcessedUpdates } from './db/queries';
import { checkRateLimit, getClientIp } from './util/rateLimit';
import { errorKind, logError, logInfo } from './util/logger';

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;
const WEBHOOK_RATE_LIMIT = 60;
const API_RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const PROCESSED_UPDATES_RETENTION_DAYS = 7;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const requestId = crypto.randomUUID();

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(request, env),
          'X-Request-Id': requestId,
        },
      });
    }

    // ── Health check ──
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      });
    }

    // ── Telegram Webhook ──
    if (path === '/webhook' && request.method === 'POST') {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const webhookSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (webhookSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }
      }

      const ip = getClientIp(request);
      if (!(await checkRateLimit(env, `webhook:${ip}`, WEBHOOK_RATE_LIMIT, RATE_WINDOW_MS))) {
        return new Response('Too Many Requests', { status: 429 });
      }

      const contentLength = Number(request.headers.get('Content-Length') ?? '0');
      if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
        return new Response('Payload Too Large', { status: 413 });
      }

      return handleWebhook(request, env, ctx, requestId);
    }

    // ── REST API ──
    if (path.startsWith('/api/')) {
      const ip = getClientIp(request);
      if (!(await checkRateLimit(env, `api:${ip}`, API_RATE_LIMIT, RATE_WINDOW_MS))) {
        return errorResponse('Too many requests', 429, request, env, { 'X-Request-Id': requestId });
      }

      try {
        if (path === '/api/tags' || path === '/api/notes' || path.startsWith('/api/notes/')) {
          return await handleNotesApi(env, request, path, requestId);
        }

        if (path === '/api/folders' || path.startsWith('/api/folders/')) {
          return await handleFoldersApi(env, request, path, requestId);
        }

        return errorResponse('Not found', 404, request, env, { 'X-Request-Id': requestId });
      } catch (err) {
        logError('api_handler_failed', {
          requestId,
          path,
          kind: errorKind(err),
        });
        return errorResponse('Internal server error', 500, request, env, { 'X-Request-Id': requestId });
      }
    }

    // ── Static / root ──
    return new Response('AI Notes Bot is running', {
      status: 200,
      headers: { 'X-Request-Id': requestId },
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      cleanupProcessedUpdates(env, PROCESSED_UPDATES_RETENTION_DAYS).catch((err) => {
        logError('cleanup_processed_updates_failed', { kind: errorKind(err) });
      })
    );
  },
};

async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  requestId: string
): Promise<Response> {
  let update: TelegramUpdate;

  try {
    const raw = await request.text();
    if (raw.length > MAX_WEBHOOK_BODY_BYTES) {
      return new Response('Payload Too Large', { status: 413 });
    }
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  let isNew = false;
  try {
    isNew = await claimUpdateId(env, update.update_id);
  } catch (err) {
    logError('claim_update_id_failed', {
      requestId,
      updateId: update.update_id,
      kind: errorKind(err),
    });
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!isNew) {
    logInfo('webhook_duplicate', { requestId, updateId: update.update_id });
    return new Response('OK', { status: 200 });
  }

  ctx.waitUntil(
    processWebhookUpdate(env, update, requestId).catch((err) => {
      logError('webhook_background_failed', {
        requestId,
        updateId: update.update_id,
        kind: errorKind(err),
      });
    })
  );

  return new Response('OK', { status: 200 });
}

async function processWebhookUpdate(
  env: Env,
  update: TelegramUpdate,
  requestId: string
): Promise<void> {
  try {
    if (update.message) {
      await handleMessage(env, update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(env, update.callback_query);
    }
  } catch (err) {
    logError('webhook_handler_failed', {
      requestId,
      updateId: update.update_id,
      kind: errorKind(err),
    });

    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (chatId) {
      try {
        await sendMessage(
          env,
          chatId,
          '⚠️ Временная ошибка сервера. Попробуй ещё раз через минуту.'
        );
      } catch {
        // Ignore secondary Telegram failures.
      }
    }
  }
}