import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src';
import { validateInitData } from '../src/api/auth';
import { escapeHtml } from '../src/bot/html';
import { extractTags, parseLlmResponse, MAX_NOTE_ITEMS } from '../src/pipeline/parser';
import { cheapGuard } from '../src/pipeline/guard';
import { buildFtsQuery } from '../src/db/queries';
import {
  isNoteType,
  parsePositiveInt,
  validateFolderId,
  validateNoteText,
  validateTags,
} from '../src/api/validation';

describe('worker routing', () => {
  it('returns ok from the health route', async () => {
    const request = new Request('http://example.com/health');
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns the service status from the root route', async () => {
    const request = new Request('http://example.com/');
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('AI Notes Bot is running');
  });

  it('returns a JSON 404 for an unknown API route', async () => {
    const request = new Request('http://example.com/api/unknown');
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('routes /api/tags through authentication', async () => {
    const request = new Request('http://example.com/api/tags');
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('rejects webhook requests without the configured secret', async () => {
    const request = new Request('http://example.com/webhook', { method: 'POST' });
    const ctx = createExecutionContext();
    const testEnv = {
      ...env,
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    };

    const response = await worker.fetch(request, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
  });
});

describe('API validation', () => {
  it('accepts only supported note types', () => {
    expect(isNoteType('tasks')).toBe(true);
    expect(isNoteType('ideas')).toBe(true);
    expect(isNoteType('calendar')).toBe(false);
    expect(isNoteType(null)).toBe(false);
  });

  it('parses only positive safe integers', () => {
    expect(parsePositiveInt('42')).toBe(42);
    expect(parsePositiveInt('0')).toBeUndefined();
    expect(parsePositiveInt('-1')).toBeUndefined();
    expect(parsePositiveInt('1.5')).toBeUndefined();
    expect(parsePositiveInt('abc')).toBeUndefined();
  });

  it('validates note text', () => {
    expect(validateNoteText('  Купить молоко  ')).toBe('Купить молоко');
    expect(validateNoteText('   ')).toBeNull();
    expect(validateNoteText(123)).toBeNull();
  });

  it('validates folder IDs', () => {
    expect(validateFolderId(7)).toBe(7);
    expect(validateFolderId(null)).toBeNull();
    expect(validateFolderId(0)).toBeUndefined();
    expect(validateFolderId('7')).toBeUndefined();
  });

  it('normalizes and deduplicates tags', () => {
    expect(validateTags(['Работа', '#Срочно', '#работа'])).toEqual([
      '#работа',
      '#срочно',
    ]);
    expect(validateTags([''])).toBeNull();
    expect(validateTags('work')).toBeNull();
  });
});

describe('text helpers', () => {
  it('escapes Telegram HTML', () => {
    expect(escapeHtml('<b>Tom & "Jerry"</b>')).toBe(
      '&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;'
    );
  });

  it('extracts unique Cyrillic and Latin hashtags', () => {
    expect(extractTags('Сделать #Работа и #work, потом снова #работа')).toEqual([
      '#работа',
      '#work',
    ]);
  });

  it('builds a safe prefix FTS query from user input', () => {
    expect(buildFtsQuery('молоко "или" сервер:prod')).toBe(
      '"молоко"* AND "или"* AND "сервер"* AND "prod"*'
    );
    expect(buildFtsQuery('***')).toBe('');
  });

  it('keeps useful notes with a question mark', () => {
    expect(cheapGuard('Уточнить, готов ли отчёт?')).toBe(true);
    expect(cheapGuard('/start')).toBe(false);
    expect(cheapGuard('да')).toBe(false);
  });

  it('parses valid LLM JSON into note items', () => {
    const raw = JSON.stringify({
      items: [
        { text: 'Купить молоко', type: 'shopping', category: 'покупки' },
        { text: 'Позвонить врачу', type: 'tasks' },
      ],
    });

    expect(parseLlmResponse(raw, 'fallback', ['#дом'])).toEqual([
      {
        text: 'Купить молоко',
        type: 'shopping',
        category: 'покупки',
        tags: ['#дом'],
      },
      {
        text: 'Позвонить врачу',
        type: 'tasks',
        category: 'tasks',
        tags: ['#дом'],
      },
    ]);
  });

  it('limits the number of parsed note items', () => {
    const items = Array.from({ length: MAX_NOTE_ITEMS + 3 }, (_, i) => ({
      text: `item ${i}`,
      type: 'notes',
    }));
    const raw = JSON.stringify({ items });
    expect(parseLlmResponse(raw, 'fallback', [])).toHaveLength(MAX_NOTE_ITEMS);
  });
});

describe('Telegram Mini App authentication', () => {
  const botToken = '123456:test-token';
  const now = 1_800_000_000;

  it('accepts valid and recent initData', async () => {
    const initData = await createInitData(botToken, now - 60, 123456);
    expect(await validateInitData(initData, botToken, now)).toBe(123456);
  });

  it('rejects expired initData', async () => {
    const initData = await createInitData(botToken, now - 25 * 60 * 60, 123456);
    expect(await validateInitData(initData, botToken, now)).toBeNull();
  });

  it('rejects a forged hash', async () => {
    const initData = await createInitData(botToken, now - 60, 123456);
    const forged = initData.replace(/hash=[a-f0-9]+/, `hash=${'0'.repeat(64)}`);
    expect(await validateInitData(forged, botToken, now)).toBeNull();
  });
});

async function createInitData(
  botToken: string,
  authDate: number,
  userId: number
): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'test-query',
    user: JSON.stringify({ id: userId, first_name: 'Test' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const encoder = new TextEncoder();

  const webAppDataKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const secretKey = await crypto.subtle.sign(
    'HMAC',
    webAppDataKey,
    encoder.encode(botToken)
  );
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode(dataCheckString)
  );
  const hash = Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  params.set('hash', hash);
  return params.toString();
}
