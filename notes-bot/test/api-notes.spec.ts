import { describe, expect, it } from 'vitest';
import { apiFetch, readJson, seedTelegramUser, createTestEnv } from './helpers/api';
import { createFolder } from '../src/db/queries';

describe('notes API', () => {
  it('returns 401 without authorization', async () => {
    const response = await apiFetch('/api/notes', { auth: false });
    expect(response.status).toBe(401);
    expect(await readJson<{ error: string }>(response)).toEqual({ error: 'Unauthorized' });
  });

  it('creates, reads, updates and deletes a note', async () => {
    const telegramId = 2001;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Купить молоко', type: 'shopping', tags: ['#дом'] },
    });
    expect(createRes.status).toBe(201);
    const created = await readJson<{ id: number; text: string; type: string; tags: string }>(createRes);
    expect(created.text).toBe('Купить молоко');
    expect(created.type).toBe('shopping');

    const getRes = await apiFetch(`/api/notes/${created.id}`, { telegramId });
    expect(getRes.status).toBe(200);
    expect((await readJson<{ text: string }>(getRes)).text).toBe('Купить молоко');

    const updateRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'PUT',
      telegramId,
      body: { text: 'Купить хлеб', done: 1 },
    });
    expect(updateRes.status).toBe(200);
    const updated = await readJson<{ text: string; done: number }>(updateRes);
    expect(updated.text).toBe('Купить хлеб');
    expect(updated.done).toBe(1);

    const deleteRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'DELETE',
      telegramId,
    });
    expect(deleteRes.status).toBe(200);
    expect(await readJson<{ success: boolean }>(deleteRes)).toEqual({ success: true });

    const missingRes = await apiFetch(`/api/notes/${created.id}`, { telegramId });
    expect(missingRes.status).toBe(404);
  });

  it('filters notes by type and tag', async () => {
    const telegramId = 2002;
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Позвонить врачу', type: 'tasks', tags: ['#здоровье'] },
    });
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Купить яблоки', type: 'shopping', tags: ['#дом'] },
    });

    const byType = await apiFetch('/api/notes?type=tasks', { telegramId });
    const typeNotes = await readJson<Array<{ type: string }>>(byType);
    expect(typeNotes.every((note) => note.type === 'tasks')).toBe(true);

    const byTag = await apiFetch('/api/notes?tag=%23дом', { telegramId });
    const tagNotes = await readJson<Array<{ tags: string }>>(byTag);
    expect(tagNotes.length).toBeGreaterThanOrEqual(1);
    expect(tagNotes.every((note) => note.tags.includes('#дом'))).toBe(true);
  });

  it('filters notes by folder', async () => {
    const telegramId = 2003;
    const user = await seedTelegramUser(telegramId);
    const folder = await createFolder(createTestEnv(), user.id, 'Работа', 'tasks');

    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Созвон с командой', type: 'tasks', folder_id: folder.id },
    });
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Без папки', type: 'notes' },
    });

    const byFolder = await apiFetch(`/api/notes?folder_id=${folder.id}`, { telegramId });
    const folderNotes = await readJson<Array<{ folder_id: number | null }>>(byFolder);
    expect(folderNotes.length).toBeGreaterThanOrEqual(1);
    expect(folderNotes.every((note) => note.folder_id === folder.id)).toBe(true);
  });

  it('searches notes with full-text search', async () => {
    const telegramId = 2004;
    const unique = `поисковаяфраза${telegramId}`;
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: `Запомни ${unique}`, type: 'notes' },
    });

    const searchRes = await apiFetch(`/api/notes/search?q=${encodeURIComponent(unique)}`, {
      telegramId,
    });
    expect(searchRes.status).toBe(200);
    const results = await readJson<Array<{ text: string }>>(searchRes);
    expect(results.some((note) => note.text.includes(unique))).toBe(true);
  });

  it('returns user tags', async () => {
    const telegramId = 2005;
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Заметка', type: 'notes', tags: ['#уникальныйтег'] },
    });

    const tagsRes = await apiFetch('/api/tags', { telegramId });
    expect(tagsRes.status).toBe(200);
    const tags = await readJson<string[]>(tagsRes);
    expect(tags).toContain('#уникальныйтег');
  });

  it('rejects access to another users note', async () => {
    const ownerId = 2006;
    const intruderId = 2007;
    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId: ownerId,
      body: { text: 'Секретная заметка', type: 'notes' },
    });
    const created = await readJson<{ id: number }>(createRes);

    const getRes = await apiFetch(`/api/notes/${created.id}`, { telegramId: intruderId });
    expect(getRes.status).toBe(404);

    const updateRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'PUT',
      telegramId: intruderId,
      body: { text: 'Взлом' },
    });
    expect(updateRes.status).toBe(404);

    const deleteRes = await apiFetch(`/api/notes/${created.id}`, {
      method: 'DELETE',
      telegramId: intruderId,
    });
    expect(deleteRes.status).toBe(404);
  });

  it('rejects assigning a note to another users folder', async () => {
    const ownerId = 2008;
    const intruderId = 2009;
    const owner = await seedTelegramUser(ownerId);
    const folder = await createFolder(createTestEnv(), owner.id, 'Личное', 'notes');

    const createRes = await apiFetch('/api/notes', {
      method: 'POST',
      telegramId: intruderId,
      body: { text: 'Попытка чужой папки', type: 'notes', folder_id: folder.id },
    });
    expect(createRes.status).toBe(404);
  });
});