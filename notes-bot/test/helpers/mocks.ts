import { fetchMock } from 'cloudflare:test';

const TELEGRAM_ORIGIN = 'https://api.telegram.org';
const OPENROUTER_ORIGIN = 'https://openrouter.ai';
const GROQ_ORIGIN = 'https://api.groq.com';

export function activateFetchMocks(): void {
  fetchMock.activate();
  fetchMock.disableNetConnect();
}

export function mockTelegramMessaging(times = 12): void {
  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/sendMessage$/, method: 'POST' })
    .reply(200, { ok: true, result: { message_id: 1 } })
    .times(times);

  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/editMessageText$/, method: 'POST' })
    .reply(200, { ok: true, result: true })
    .times(times);

  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/answerCallbackQuery$/, method: 'POST' })
    .reply(200, { ok: true, result: true })
    .times(times);

  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/sendChatAction$/, method: 'POST' })
    .reply(200, { ok: true, result: true })
    .times(times);

  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/setChatMenuButton$/, method: 'POST' })
    .reply(200, { ok: true, result: true })
    .times(times);
}

export function mockOpenRouterResponse(content: string, times = 1): void {
  fetchMock
    .get(OPENROUTER_ORIGIN)
    .intercept({ path: '/api/v1/chat/completions', method: 'POST' })
    .reply(200, {
      choices: [{ message: { content } }],
    })
    .times(times);
}

export function mockGroqTranscription(text: string): void {
  fetchMock
    .get(GROQ_ORIGIN)
    .intercept({ path: '/openai/v1/audio/transcriptions', method: 'POST' })
    .reply(200, { text })
    .times(1);

  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/getFile$/, method: 'POST' })
    .reply(200, {
      ok: true,
      result: { file_path: 'voice/file.ogg' },
    })
    .times(1);

  fetchMock
    .get(TELEGRAM_ORIGIN)
    .intercept({ path: /\/file\/bot.*/, method: 'GET' })
    .reply(200, new Uint8Array([1, 2, 3]))
    .times(1);
}