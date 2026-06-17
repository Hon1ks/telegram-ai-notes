import { env, createExecutionContext, waitOnExecutionContext, fetchMock } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src';
import { parseNotes } from '../src/pipeline/parser';
import { getOrCreateUser } from '../src/db/queries';
import {
  activateFetchMocks,
  mockGroqTranscription,
  mockOpenRouterResponse,
  mockTelegramMessaging,
} from './helpers/mocks';
import { createTestEnv } from './helpers/api';

describe('AI pipeline integration', () => {
  beforeEach(() => {
    activateFetchMocks();
  });

  afterEach(() => {
    fetchMock.assertNoPendingInterceptors();
  });

  it('falls back to a raw note when LLM returns invalid JSON twice', async () => {
    mockOpenRouterResponse('not-json', 2);

    const testEnv = createTestEnv();
    const user = await getOrCreateUser(testEnv, 5101);
    const items = await parseNotes(testEnv, user.id, 'Купить молоко #дом');
    expect(items).toEqual([
      {
        text: 'Купить молоко #дом',
        type: 'notes',
        category: 'notes',
        tags: ['#дом'],
      },
    ]);
  });

  it('parses a valid LLM response into classified note items', async () => {
    mockOpenRouterResponse(JSON.stringify({
      items: [
        { text: 'Купить молоко', type: 'shopping' },
        { text: 'Позвонить врачу', type: 'tasks' },
      ],
    }));

    const testEnv = createTestEnv();
    const user = await getOrCreateUser(testEnv, 5102);
    const items = await parseNotes(testEnv, user.id, 'Купить молоко и позвонить врачу');
    expect(items).toHaveLength(2);
    expect(items[0]?.type).toBe('shopping');
    expect(items[1]?.type).toBe('tasks');
  });
});

describe('webhook integration', () => {
  beforeEach(() => {
    activateFetchMocks();
    mockTelegramMessaging();
  });

  it('processes text -> LLM -> D1 in the background', async () => {
    const telegramId = 4001;
    const testEnv = createTestEnv();
    const user = await getOrCreateUser(testEnv, telegramId);

    mockOpenRouterResponse(JSON.stringify({ ignore: false }));
    mockOpenRouterResponse(JSON.stringify({
      items: [{ text: 'Записать интеграционный тест', type: 'tasks' }],
    }));

    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request('http://example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 9_400_001,
          message: {
            message_id: 1,
            from: { id: telegramId, is_bot: false, first_name: 'Test' },
            chat: { id: telegramId, type: 'private' },
            date: 1_800_000_000,
            text: 'Записать интеграционный тест',
          },
        }),
      }),
      testEnv,
      ctx
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);

    const notes = await env.NOTES_DB
      .prepare('SELECT text, type FROM notes WHERE user_id = ? ORDER BY id DESC')
      .bind(user.id)
      .all<{ text: string; type: string }>();

    expect(notes.results[0]?.text).toBe('Записать интеграционный тест');
    expect(notes.results[0]?.type).toBe('tasks');
  });

  it('asks STT confirmation before saving voice notes', async () => {
    const telegramId = 4002;
    const testEnv = createTestEnv();
    const user = await getOrCreateUser(testEnv, telegramId);
    const recognized = 'Купить батарейки для пульта';

    mockGroqTranscription(recognized);
    mockOpenRouterResponse(JSON.stringify({ ignore: false }));
    mockOpenRouterResponse(JSON.stringify({
      items: [{ text: recognized, type: 'shopping' }],
    }));

    const voiceCtx = createExecutionContext();
    const voiceResponse = await worker.fetch(
      new Request('http://example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 9_400_002,
          message: {
            message_id: 2,
            from: { id: telegramId, is_bot: false, first_name: 'Test' },
            chat: { id: telegramId, type: 'private' },
            date: 1_800_000_000,
            voice: {
              file_id: 'voice-file-1',
              file_unique_id: 'voice-unique-1',
              duration: 3,
            },
          },
        }),
      }),
      testEnv,
      voiceCtx
    );
    await waitOnExecutionContext(voiceCtx);
    expect(voiceResponse.status).toBe(200);

    const beforeConfirm = await env.NOTES_DB
      .prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?')
      .bind(user.id)
      .first<{ count: number }>();
    expect(beforeConfirm?.count).toBe(0);

    const confirmCtx = createExecutionContext();
    const confirmResponse = await worker.fetch(
      new Request('http://example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 9_400_002_1,
          callback_query: {
            id: 'cbq-stt-ok',
            from: { id: telegramId, is_bot: false, first_name: 'Test' },
            message: {
              message_id: 1,
              from: { id: 1, is_bot: true, first_name: 'Bot' },
              chat: { id: telegramId, type: 'private' },
              date: 1_800_000_000,
              text: recognized,
            },
            data: 'stt:ok',
          },
        }),
      }),
      testEnv,
      confirmCtx
    );
    await waitOnExecutionContext(confirmCtx);
    expect(confirmResponse.status).toBe(200);

    const notes = await env.NOTES_DB
      .prepare('SELECT text, type FROM notes WHERE user_id = ? ORDER BY id DESC')
      .bind(user.id)
      .all<{ text: string; type: string }>();

    expect(notes.results[0]?.text).toBe(recognized);
    expect(notes.results[0]?.type).toBe('shopping');
  });

  it('undoes the last saved note from inline button', async () => {
    const telegramId = 4004;
    const testEnv = createTestEnv();
    const user = await getOrCreateUser(testEnv, telegramId);
    const text = 'Временная заметка для undo';

    mockOpenRouterResponse(JSON.stringify({ ignore: false }));
    mockOpenRouterResponse(JSON.stringify({
      items: [{ text, type: 'notes' }],
    }));

    const saveCtx = createExecutionContext();
    await worker.fetch(
      new Request('http://example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 9_400_004,
          message: {
            message_id: 4,
            from: { id: telegramId, is_bot: false, first_name: 'Test' },
            chat: { id: telegramId, type: 'private' },
            date: 1_800_000_000,
            text,
          },
        }),
      }),
      testEnv,
      saveCtx
    );
    await waitOnExecutionContext(saveCtx);

    const saved = await env.NOTES_DB
      .prepare('SELECT id FROM notes WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .bind(user.id)
      .first<{ id: number }>();
    expect(saved?.id).toBeTruthy();

    const undoCtx = createExecutionContext();
    await worker.fetch(
      new Request('http://example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 9_400_004_1,
          callback_query: {
            id: 'cbq-undo',
            from: { id: telegramId, is_bot: false, first_name: 'Test' },
            message: {
              message_id: 5,
              from: { id: 1, is_bot: true, first_name: 'Bot' },
              chat: { id: telegramId, type: 'private' },
              date: 1_800_000_000,
              text: 'saved',
            },
            data: `undo:${saved!.id}`,
          },
        }),
      }),
      testEnv,
      undoCtx
    );
    await waitOnExecutionContext(undoCtx);

    const remaining = await env.NOTES_DB
      .prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?')
      .bind(user.id)
      .first<{ count: number }>();
    expect(remaining?.count).toBe(0);
  });

  it('saves a fallback note when classification is unavailable', async () => {
    const telegramId = 4003;
    const testEnv = createTestEnv();
    const user = await getOrCreateUser(testEnv, telegramId);
    const text = 'Сохранить даже при падении LLM';

    mockOpenRouterResponse('', 3);

    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request('http://example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 9_400_003,
          message: {
            message_id: 3,
            from: { id: telegramId, is_bot: false, first_name: 'Test' },
            chat: { id: telegramId, type: 'private' },
            date: 1_800_000_000,
            text,
          },
        }),
      }),
      testEnv,
      ctx
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);

    const notes = await env.NOTES_DB
      .prepare('SELECT text, type FROM notes WHERE user_id = ? ORDER BY id DESC')
      .bind(user.id)
      .all<{ text: string; type: string }>();

    expect(notes.results[0]?.text).toBe(text);
    expect(notes.results[0]?.type).toBe('notes');
  });
});