import type { Env } from '../types';

const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, X-Request-Id';
import { getUserByTelegramId } from '../db/queries';
import type { DbUser } from '../types';

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Validates Telegram WebApp initData and returns the authenticated DB user.
 * Returns null if validation fails.
 */
export async function authenticate(env: Env, request: Request): Promise<DbUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('tma ')) return null;

  const initData = authHeader.slice(4);
  const telegramId = await validateInitData(initData, env.TELEGRAM_TOKEN);
  if (!telegramId) return null;

  return getUserByTelegramId(env, telegramId);
}

export async function validateInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<number | null> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const encoder = new TextEncoder();

    // secret_key = HMAC-SHA256("WebAppData", bot_token)
    const webAppDataKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyData = await crypto.subtle.sign(
      'HMAC',
      webAppDataKey,
      encoder.encode(botToken)
    );

    // hash = HMAC-SHA256(secret_key, data_check_string)
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoder.encode(dataCheckString)
    );

    const expectedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (!constantTimeHexEqual(expectedHash, hash)) return null;

    const authDateRaw = params.get('auth_date');
    if (!authDateRaw || !/^\d+$/.test(authDateRaw)) return null;

    const authDate = Number(authDateRaw);
    if (!Number.isSafeInteger(authDate)) return null;
    if (authDate > nowSeconds + MAX_CLOCK_SKEW_SECONDS) return null;
    if (nowSeconds - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr) as { id?: unknown };
    if (
      typeof user.id !== 'number'
      || !Number.isSafeInteger(user.id)
      || user.id <= 0
    ) {
      return null;
    }

    return user.id;
  } catch {
    return null;
  }
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let i = 0; i < left.length; i++) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

export function corsHeaders(request: Request | null, env: Env): HeadersInit {
  const origin = request?.headers.get('Origin');
  const allowed = env.MINIAPP_ORIGIN?.trim();

  if (!allowed) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': CORS_METHODS,
      'Access-Control-Allow-Headers': CORS_HEADERS,
    };
  }

  if (origin === allowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': CORS_METHODS,
      'Access-Control-Allow-Headers': CORS_HEADERS,
      'Vary': 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS,
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  data: unknown,
  status = 200,
  request: Request | null = null,
  env?: Env,
  extraHeaders: HeadersInit = {}
): Response {
  const cors = env ? corsHeaders(request, env) : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
      ...extraHeaders,
    },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  request: Request | null = null,
  env?: Env,
  extraHeaders: HeadersInit = {}
): Response {
  return jsonResponse({ error: message }, status, request, env, extraHeaders);
}
