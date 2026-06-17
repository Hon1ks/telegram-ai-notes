import { describe, expect, it } from 'vitest';
import { apiFetch, readJson } from './helpers/api';

describe('export API', () => {
  it('returns 401 without authorization', async () => {
    const response = await apiFetch('/api/export?format=json', { auth: false });
    expect(response.status).toBe(401);
  });

  it('exports notes as JSON', async () => {
    const telegramId = 3101;
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Экспорт JSON', type: 'notes', tags: ['#export'] },
    });

    const response = await apiFetch('/api/export?format=json', { telegramId });
    expect(response.status).toBe(200);

    const payload = await readJson<{
      exported_at: string;
      notes: Array<{ text: string; tags: string[] }>;
      folders: unknown[];
      categories: unknown[];
    }>(response);

    expect(payload.exported_at).toBeTruthy();
    expect(payload.notes.some((note) => note.text === 'Экспорт JSON')).toBe(true);
    expect(payload.categories.length).toBeGreaterThan(0);
  });

  it('exports notes as Markdown', async () => {
    const telegramId = 3102;
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Экспорт Markdown', type: 'notes' },
    });

    const response = await apiFetch('/api/export?format=md', { telegramId });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/markdown');

    const body = await response.text();
    expect(body).toContain('# AI Notes Export');
    expect(body).toContain('Экспорт Markdown');
  });

  it('rejects invalid format', async () => {
    const response = await apiFetch('/api/export?format=csv', { telegramId: 3103 });
    expect(response.status).toBe(400);
    expect(await readJson<{ error: string }>(response)).toEqual({
      error: 'format must be json or md',
    });
  });

  it('excludes soft-deleted notes from export', async () => {
    const telegramId = 3104;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Удалённая для экспорта', type: 'notes' },
    });
    const created = await readJson<{ id: number }>(createRes);
    await apiFetch(`/api/notes/${created.id}`, { method: 'DELETE', telegramId });

    const response = await apiFetch('/api/export?format=json', { telegramId });
    const payload = await readJson<{ notes: Array<{ text: string }> }>(response);
    expect(payload.notes.some((note) => note.text === 'Удалённая для экспорта')).toBe(false);
  });
});