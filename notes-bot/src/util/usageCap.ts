import type { Env } from '../types';

export type UsageService = 'llm' | 'stt';

const DEFAULT_CAPS: Record<UsageService, number> = {
  llm: 50,
  stt: 20,
};

const memoryUsage = new Map<string, number>();

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function usageKey(userId: number, service: UsageService): string {
  return `usage:${service}:${userId}:${dayKey()}`;
}

function ttlSecondsUntilUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  ));
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}

async function readCount(env: Env, key: string): Promise<number> {
  if (env.RATE_LIMIT) {
    const raw = await env.RATE_LIMIT.get(key);
    return Number(raw ?? '0') || 0;
  }
  return memoryUsage.get(key) ?? 0;
}

async function writeCount(env: Env, key: string, count: number): Promise<void> {
  const ttl = ttlSecondsUntilUtcMidnight();
  if (env.RATE_LIMIT) {
    await env.RATE_LIMIT.put(key, String(count), { expirationTtl: ttl });
  } else {
    memoryUsage.set(key, count);
  }
}

export function getUsageCap(service: UsageService): number {
  return DEFAULT_CAPS[service];
}

export async function getUsageCount(
  env: Env,
  userId: number,
  service: UsageService
): Promise<number> {
  return readCount(env, usageKey(userId, service));
}

export async function checkUsageCap(
  env: Env,
  userId: number,
  service: UsageService
): Promise<boolean> {
  const count = await getUsageCount(env, userId, service);
  return count < getUsageCap(service);
}

export async function consumeUsage(
  env: Env,
  userId: number,
  service: UsageService
): Promise<boolean> {
  const key = usageKey(userId, service);
  const count = await readCount(env, key);
  if (count >= getUsageCap(service)) return false;
  await writeCount(env, key, count + 1);
  return true;
}

export class UsageCapExceeded extends Error {
  readonly service: UsageService;

  constructor(service: UsageService) {
    super(`Daily ${service} cap exceeded`);
    this.name = 'UsageCapExceeded';
    this.service = service;
  }
}