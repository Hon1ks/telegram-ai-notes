import { describe, expect, it } from 'vitest';
import {
  checkUsageCap,
  consumeUsage,
  getUsageCap,
  getUsageCount,
} from '../src/util/usageCap';
import { createTestEnv } from './helpers/api';
import { getOrCreateUser } from '../src/db/queries';

describe('usageCap', () => {
  it('tracks daily LLM usage per user', async () => {
    const env = createTestEnv();
    const user = await getOrCreateUser(env, 8801);

    expect(getUsageCap('llm')).toBe(50);
    expect(await getUsageCount(env, user.id, 'llm')).toBe(0);
    expect(await checkUsageCap(env, user.id, 'llm')).toBe(true);

    expect(await consumeUsage(env, user.id, 'llm')).toBe(true);
    expect(await getUsageCount(env, user.id, 'llm')).toBe(1);
  });

  it('blocks when STT daily cap is reached', async () => {
    const env = createTestEnv();
    const user = await getOrCreateUser(env, 8802);
    const cap = getUsageCap('stt');

    for (let i = 0; i < cap; i++) {
      expect(await consumeUsage(env, user.id, 'stt')).toBe(true);
    }

    expect(await checkUsageCap(env, user.id, 'stt')).toBe(false);
    expect(await consumeUsage(env, user.id, 'stt')).toBe(false);
  });
});