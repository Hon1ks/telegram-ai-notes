import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import type { Env } from '../../src/types';
import worker from '../../src';
import { getOrCreateUser } from '../../src/db/queries';
import { authHeader, createInitData, TEST_BOT_TOKEN } from './auth';

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    ...env,
    TELEGRAM_TOKEN: TEST_BOT_TOKEN,
    OPENROUTER_API_KEY: 'test-openrouter-key',
    STT_API_KEY: 'test-stt-key',
    ...overrides,
  };
}

export async function seedTelegramUser(telegramId: number) {
  return getOrCreateUser(createTestEnv(), telegramId);
}

export async function apiFetch(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    telegramId?: number;
    testEnv?: Env;
    auth?: boolean;
  } = {}
): Promise<Response> {
  const testEnv = options.testEnv ?? createTestEnv();
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.auth !== false) {
    const telegramId = options.telegramId ?? 1001;
    await seedTelegramUser(telegramId);
    const initData = await createInitData(
      testEnv.TELEGRAM_TOKEN,
      Math.floor(Date.now() / 1000) - 60,
      telegramId
    );
    Object.assign(headers, authHeader(initData));
  }

  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(`http://example.com${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }),
    testEnv,
    ctx
  );
  await waitOnExecutionContext(ctx);
  return response;
}

export async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}