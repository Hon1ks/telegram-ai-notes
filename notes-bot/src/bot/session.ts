import type { Env } from '../types';

const STT_TTL_SECONDS = 600;
const KEY_PREFIX = 'bot:';

type Stored<T> = { v: T; exp: number };

const memory = new Map<string, string>();

function memKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export interface PendingStt {
  text: string;
  chatId: number;
  messageId: number;
}

export async function setPendingStt(env: Env, userId: number, data: PendingStt): Promise<void> {
  const key = `stt:${userId}`;
  const payload = JSON.stringify({ v: data, exp: Date.now() + STT_TTL_SECONDS * 1000 });
  if (env.RATE_LIMIT) {
    await env.RATE_LIMIT.put(memKey(key), payload, { expirationTtl: STT_TTL_SECONDS });
  } else {
    memory.set(memKey(key), payload);
  }
}

export async function getPendingStt(env: Env, userId: number): Promise<PendingStt | null> {
  const key = `stt:${userId}`;
  const raw = env.RATE_LIMIT
    ? await env.RATE_LIMIT.get(memKey(key))
    : memory.get(memKey(key)) ?? null;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Stored<PendingStt>;
    if (parsed.exp < Date.now()) {
      await clearPendingStt(env, userId);
      return null;
    }
    return parsed.v;
  } catch {
    return null;
  }
}

export async function clearPendingStt(env: Env, userId: number): Promise<void> {
  const key = `stt:${userId}`;
  if (env.RATE_LIMIT) {
    await env.RATE_LIMIT.delete(memKey(key));
  } else {
    memory.delete(memKey(key));
  }
}