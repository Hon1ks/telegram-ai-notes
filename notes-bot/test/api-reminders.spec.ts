import { describe, expect, it } from 'vitest';
import { apiFetch, readJson, seedTelegramUser, createTestEnv } from './helpers/api';
import { createNote, getDueReminders, updateNote } from '../src/db/queries';

describe('reminders API and queries', () => {
  it('sets and clears remind_at via PUT', async () => {
    const telegramId = 3201;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Напомни', type: 'tasks' },
    });
    const created = await readJson<{ id: number; remind_at: string | null }>(createRes);
    expect(created.remind_at).toBeNull();

    const updateRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'PUT',
      telegramId,
      body: { remind_at: '2030-06-17T12:00:00.000Z' },
    });
    expect(updateRes.status).toBe(200);
    const updated = await readJson<{ remind_at: string | null }>(updateRes);
    expect(updated.remind_at).toBeTruthy();

    const clearRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'PUT',
      telegramId,
      body: { remind_at: null },
    });
    const cleared = await readJson<{ remind_at: string | null }>(clearRes);
    expect(cleared.remind_at).toBeNull();
  });

  it('rejects invalid remind_at', async () => {
    const telegramId = 3202;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Напомни', type: 'tasks' },
    });
    const created = await readJson<{ id: number }>(createRes);

    const updateRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'PUT',
      telegramId,
      body: { remind_at: 'not-a-date' },
    });
    expect(updateRes.status).toBe(400);
  });

  it('finds due reminders in queries', async () => {
    const telegramId = 3203;
    const user = await seedTelegramUser(telegramId);
    const env = createTestEnv();
    const note = await createNote(env, user.id, 'tasks', 'Просроченное напоминание');

    await updateNote(env, note.id, user.id, {
      remind_at: '2000-01-01 00:00:00',
    });

    const due = await getDueReminders(env);
    expect(due.some((item) => item.note_id === note.id)).toBe(true);
    expect(due.find((item) => item.note_id === note.id)?.telegram_id).toBe(String(telegramId));
  });
});