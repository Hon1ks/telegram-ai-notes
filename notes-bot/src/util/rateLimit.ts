import type { Env } from '../types';

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (env.RATE_LIMIT) {
    return checkKvRateLimit(env.RATE_LIMIT, key, limit, windowMs);
  }
  return checkMemoryRateLimit(key, limit, windowMs);
}

function checkMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

async function checkKvRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const kvKey = `rl:${key}:${windowStart}`;
  const ttlSeconds = Math.ceil(windowMs / 1000) + 5;

  const current = Number(await kv.get(kvKey));
  if (!Number.isFinite(current)) {
    await kv.put(kvKey, '1', { expirationTtl: ttlSeconds });
    return true;
  }

  if (current >= limit) return false;

  await kv.put(kvKey, String(current + 1), { expirationTtl: ttlSeconds });
  return true;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown'
  );
}