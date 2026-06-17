export const TEST_BOT_TOKEN = '123456:test-token';
export const TEST_NOW_SECONDS = 1_800_000_000;

export async function createInitData(
  botToken: string,
  authDate: number,
  userId: number
): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'test-query',
    user: JSON.stringify({ id: userId, first_name: 'Test' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const encoder = new TextEncoder();

  const webAppDataKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const secretKey = await crypto.subtle.sign(
    'HMAC',
    webAppDataKey,
    encoder.encode(botToken)
  );
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode(dataCheckString)
  );
  const hash = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  params.set('hash', hash);
  return params.toString();
}

export function authHeader(initData: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `tma ${initData}`,
  };
}