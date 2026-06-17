import { describe, expect, it } from 'vitest';
import { backupD1ToR2 } from '../src/ops/backup';
import { createTestEnv } from './helpers/api';
import { getOrCreateUser } from '../src/db/queries';

describe('backupD1ToR2', () => {
  it('skips backup when R2 bucket is not configured', async () => {
    const env = createTestEnv();
    await getOrCreateUser(env, 8901);

    const result = await backupD1ToR2(env);
    expect(result).toBeNull();
  });
});