import type { Env } from '../types';
import { getUserByTelegramId } from '../db/queries';
import type { DbUser } from '../types';

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

async function validateInitData(initData: string, botToken: string): Promise<number | null> {
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

    if (expectedHash !== hash) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr) as { id: number };
    return user.id;
  } catch {
    return null;
  }
}

export function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
