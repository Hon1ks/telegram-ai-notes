import { describe, expect, it } from 'vitest';
import { apiFetch, readJson, seedTelegramUser } from './helpers/api';

describe('categories API', () => {
  it('returns 401 without authorization', async () => {
    const response = await apiFetch('/api/categories', { auth: false });
    expect(response.status).toBe(401);
  });

  it('returns default system categories for a new user', async () => {
    const telegramId = 6001;
    const response = await apiFetch('/api/categories', { telegramId });
    expect(response.status).toBe(200);
    const categories = await readJson<Array<{ slug: string; is_system: number }>>(response);
    const slugs = categories.map((category) => category.slug);
    expect(slugs).toEqual(expect.arrayContaining(['tasks', 'ideas', 'shopping', 'notes']));
    expect(categories.filter((category) => category.is_system === 1)).toHaveLength(4);
  });

  it('creates, updates and deletes a custom category', async () => {
    const telegramId = 6002;
    const createRes = await apiFetch('/api/categories', {
      method: 'POST',
      telegramId,
      body: {
        slug: 'health',
        name: 'Здоровье',
        emoji: '🏥',
        color: '#10b981',
        llm_hint: 'врачи, тренировки, питание',
      },
    });
    expect(createRes.status).toBe(201);
    const created = await readJson<{ id: number; slug: string; name: string }>(createRes);
    expect(created.slug).toBe('health');

    const updateRes = await apiFetch(`/api/categories/${created.id}`, {
      method: 'PUT',
      telegramId,
      body: { name: 'Здоровье и спорт', llm_hint: 'спорт, врачи' },
    });
    expect(updateRes.status).toBe(200);
    const updated = await readJson<{ name: string; llm_hint: string | null }>(updateRes);
    expect(updated.name).toBe('Здоровье и спорт');
    expect(updated.llm_hint).toBe('спорт, врачи');

    const deleteRes = await apiFetch(`/api/categories/${created.id}`, {
      method: 'DELETE',
      telegramId,
    });
    expect(deleteRes.status).toBe(200);
  });

  it('rejects deleting a system category', async () => {
    const telegramId = 6003;
    const listRes = await apiFetch('/api/categories', { telegramId });
    const categories = await readJson<Array<{ id: number; slug: string; is_system: number }>>(listRes);
    const system = categories.find((category) => category.slug === 'tasks');
    expect(system).toBeTruthy();

    const deleteRes = await apiFetch(`/api/categories/${system!.id}`, {
      method: 'DELETE',
      telegramId,
    });
    expect(deleteRes.status).toBe(400);
  });

  it('allows filtering notes by a custom category slug', async () => {
    const telegramId = 6004;
    await apiFetch('/api/categories', {
      method: 'POST',
      telegramId,
      body: { slug: 'finance', name: 'Финансы', llm_hint: 'деньги, бюджет, оплата' },
    });

    await apiFetch('/api/notes', {
      method: 'POST',
      telegramId,
      body: { text: 'Оплатить интернет', type: 'finance' },
    });

    const notesRes = await apiFetch('/api/notes?type=finance', { telegramId });
    const notes = await readJson<Array<{ type: string; text: string }>>(notesRes);
    expect(notes.some((note) => note.type === 'finance' && note.text.includes('интернет'))).toBe(true);
  });

  it('rejects duplicate slug for the same user', async () => {
    const telegramId = 6005;
    await apiFetch('/api/categories', {
      method: 'POST',
      telegramId,
      body: { slug: 'work', name: 'Работа' },
    });

    const duplicateRes = await apiFetch('/api/categories', {
      method: 'POST',
      telegramId,
      body: { slug: 'work', name: 'Работа 2' },
    });
    expect(duplicateRes.status).toBe(409);
  });

  it('isolates categories between users', async () => {
    const ownerId = 6006;
    const intruderId = 6007;
    const owner = await seedTelegramUser(ownerId);
    void owner;

    const createRes = await apiFetch('/api/categories', {
      method: 'POST',
      telegramId: ownerId,
      body: { slug: 'private_cat', name: 'Приватная' },
    });
    const created = await readJson<{ id: number }>(createRes);

    const getRes = await apiFetch(`/api/categories/${created.id}`, { telegramId: intruderId });
    expect(getRes.status).toBe(404);
  });
});