import { describe, expect, it } from 'vitest';
import { createTestEnv, seedTelegramUser } from './helpers/api';
import { createNote, softDeleteNote, restoreNote, deleteNote } from '../src/db/queries';

describe('trash queries', () => {
  it('soft delete, restore and hard delete cycle', async () => {
    const telegramId = 3301;
    const user = await seedTelegramUser(telegramId);
    const env = createTestEnv();
    const note = await createNote(env, user.id, 'notes', 'cycle test');

    await softDeleteNote(env, note.id, user.id);
    await restoreNote(env, note.id, user.id);
    await softDeleteNote(env, note.id, user.id);

    await expect(deleteNote(env, note.id, user.id)).resolves.toBeUndefined();
  });
});