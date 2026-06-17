import { describe, expect, it } from 'vitest';
import { apiFetch, readJson, seedTelegramUser, createTestEnv } from './helpers/api';
import { createFolder } from '../src/db/queries';

describe('folders API', () => {
  it('returns 401 without authorization', async () => {
    const response = await apiFetch('/api/folders', { auth: false });
    expect(response.status).toBe(401);
  });

  it('creates, reads, updates and deletes a folder', async () => {
    const telegramId = 3001;
    const createRes = await apiFetch('/api/folders', {
      method: 'POST',
      telegramId,
      body: { name: 'Дом', category: 'shopping' },
    });
    expect(createRes.status).toBe(201);
    const created = await readJson<{ id: number; name: string; category: string | null }>(createRes);
    expect(created.name).toBe('Дом');
    expect(created.category).toBe('shopping');

    const getRes = await apiFetch(`/api/folders/${created.id}`, { telegramId });
    expect(getRes.status).toBe(200);

    const updateRes = await apiFetch(`/api/folders/${created.id}`, {
      method: 'PUT',
      telegramId,
      body: { name: 'Дом и быт', category: 'notes' },
    });
    expect(updateRes.status).toBe(200);
    const updated = await readJson<{ name: string; category: string | null }>(updateRes);
    expect(updated.name).toBe('Дом и быт');
    expect(updated.category).toBe('notes');

    const deleteRes = await apiFetch(`/api/folders/${created.id}`, {
      method: 'DELETE',
      telegramId,
    });
    expect(deleteRes.status).toBe(200);

    const missingRes = await apiFetch(`/api/folders/${created.id}`, { telegramId });
    expect(missingRes.status).toBe(404);
  });

  it('lists folders with uncategorized count', async () => {
    const telegramId = 3002;
    await apiFetch('/api/folders', {
      method: 'POST',
      telegramId,
      body: { name: 'Идеи', category: 'ideas' },
    });
    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Без папки', type: 'notes' },
    });

    const listRes = await apiFetch('/api/folders', { telegramId });
    expect(listRes.status).toBe(200);
    const payload = await readJson<{ folders: Array<{ name: string }>; uncategorized: number }>(listRes);
    expect(payload.folders.length).toBeGreaterThanOrEqual(1);
    expect(payload.uncategorized).toBeGreaterThanOrEqual(1);
  });

  it('reorders folders', async () => {
    const telegramId = 3003;
    const first = await readJson<{ id: number }>(
      await apiFetch('/api/folders', {
        method: 'POST',
        telegramId,
        body: { name: 'A' },
      })
    );
    const second = await readJson<{ id: number }>(
      await apiFetch('/api/folders', {
        method: 'POST',
        telegramId,
        body: { name: 'B' },
      })
    );

    const reorderRes = await apiFetch('/api/folders/reorder', {
      method: 'POST',
      telegramId,
      body: { ids: [second.id, first.id] },
    });
    expect(reorderRes.status).toBe(200);
    const reordered = await readJson<Array<{ id: number; sort_order: number }>>(reorderRes);
    expect(reordered[0]?.id).toBe(second.id);
    expect(reordered[1]?.id).toBe(first.id);
  });

  it('rejects access to another users folder', async () => {
    const ownerId = 3004;
    const intruderId = 3005;
    const owner = await seedTelegramUser(ownerId);
    const folder = await createFolder(createTestEnv(), owner.id, 'Секретная папка', 'notes');

    expect((await apiFetch(`/api/folders/${folder.id}`, { telegramId: intruderId })).status).toBe(404);
    expect(
      (await apiFetch(`/api/folders/${folder.id}`, {
        method: 'PUT',
        telegramId: intruderId,
        body: { name: 'Взлом' },
      })).status
    ).toBe(404);
    expect(
      (await apiFetch(`/api/folders/${folder.id}`, {
        method: 'DELETE',
        telegramId: intruderId,
      })).status
    ).toBe(404);
  });
});