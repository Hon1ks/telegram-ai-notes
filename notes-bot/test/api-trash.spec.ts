import { describe, expect, it } from 'vitest';
import { apiFetch, readJson } from './helpers/api';

describe('trash API', () => {
  it('soft deletes, lists trash, restores and permanently deletes', async () => {
    const telegramId = 3001;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'В корзину', type: 'notes' },
    });
    const created = await readJson<{ id: number }>(createRes);

    const deleteRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'DELETE',
      telegramId,
    });
    expect(deleteRes.status).toBe(200);

    const missingRes = await apiFetch(`/api/notes/${created.id}`, { telegramId });
    expect(missingRes.status).toBe(404);

    const trashRes = await apiFetch('/api/notes?trash=1', { telegramId });
    const trashNotes = await readJson<Array<{ id: number; deleted_at: string | null }>>(trashRes);
    expect(trashNotes.some((note) => note.id === created.id)).toBe(true);
    expect(trashNotes.find((note) => note.id === created.id)?.deleted_at).toBeTruthy();

    const restoreRes = await apiFetch(`/api/notes/${created.id}/restore`, {
      method: 'POST',
      telegramId,
    });
    expect(restoreRes.status).toBe(200);
    const restored = await readJson<{ id: number; deleted_at: string | null }>(restoreRes);
    expect(restored.deleted_at).toBeNull();

    const activeRes = await apiFetch(`/api/notes/${created.id}`, { telegramId });
    expect(activeRes.status).toBe(200);

    await apiFetch(`/api/notes/${created.id}`, { method: 'DELETE', telegramId });

    const permanentRes = await apiFetch(`/api/notes/${created.id}/permanent`, {
      method: 'DELETE',
      telegramId,
    });
    expect(permanentRes.status).toBe(200);

    const trashAfterPurge = await apiFetch('/api/notes?trash=1', { telegramId });
    const trashAfter = await readJson<Array<{ id: number }>>(trashAfterPurge);
    expect(trashAfter.some((note) => note.id === created.id)).toBe(false);
  });

  it('excludes soft-deleted notes from search and tags', async () => {
    const telegramId = 3002;
    const unique = `trashsearch${telegramId}`;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: unique, type: 'notes', tags: ['#trashonly'] },
    });
    const created = await readJson<{ id: number }>(createRes);

    await apiFetch(`/api/notes/${created.id}`, { method: 'DELETE', telegramId });

    const searchRes = await apiFetch(`/api/notes/search?q=${encodeURIComponent(unique)}`, {
      telegramId,
    });
    const searchResults = await readJson<Array<{ id: number }>>(searchRes);
    expect(searchResults.some((note) => note.id === created.id)).toBe(false);

    const tagsRes = await apiFetch('/api/tags', { telegramId });
    const tags = await readJson<string[]>(tagsRes);
    expect(tags).not.toContain('#trashonly');
  });

  it('rejects permanent delete for active notes', async () => {
    const telegramId = 3003;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Активная', type: 'notes' },
    });
    const created = await readJson<{ id: number }>(createRes);

    const permanentRes = await apiFetch(`/api/notes/${created.id}/permanent`, {
      method: 'DELETE',
      telegramId,
    });
    expect(permanentRes.status).toBe(404);
  });
});