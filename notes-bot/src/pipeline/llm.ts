import type { Env } from '../types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'stepfun/step-3.5-flash:free';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function getModel(env: Env): string {
  return env.LLM_MODEL?.trim() || DEFAULT_MODEL;
}

function getTimeoutMs(env: Env): number {
  const parsed = Number(env.LLM_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Base LLM call via OpenRouter.
 * Returns raw string content from the model.
 */
export async function callLLM(env: Env, prompt: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://notes-bot.workers.dev',
            'X-Title': 'AI Notes Bot',
          },
          body: JSON.stringify({
            model: getModel(env),
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        getTimeoutMs(env)
      );

      if (!res.ok) {
        const status = res.status;
        if (status >= 500 && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error(`OpenRouter error ${status}`);
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content ?? '';
      return extractJson(content);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('LLM request failed');
}

/**
 * Extracts JSON from model response (strips markdown code blocks if present).
 */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return trimmed;
}

/**
 * Processes text through LLM: splits into semantic parts and classifies each.
 * Returns raw JSON string with { items: NoteItem[] }.
 */
export async function processNotes(env: Env, text: string): Promise<string> {
  const prompt = `Ты — ассистент для обработки заметок. Раздели текст на отдельные смысловые части и классифицируй каждую.

Категории:
- tasks — задачи, дела, что нужно сделать
- ideas — идеи, мысли, планы
- shopping — покупки, что купить
- notes — всё остальное

Не меняй смысл и формулировки заметок. Верни не больше 10 элементов.
Верни СТРОГО валидный JSON без текста вне JSON:
{"items":[{"text":"текст заметки","type":"tasks","category":"задачи"}]}

Текст: ${text}`;

  return callLLM(env, prompt);
}

/**
 * Retry call with a correction prompt after invalid JSON.
 */
export async function retryProcessNotes(env: Env, text: string): Promise<string> {
  const prompt = `Ты вернул невалидный JSON. Исправь формат.

Раздели текст на части, классифицируй каждую. Не меняй смысл заметок. Верни не больше 10 элементов.
Верни ТОЛЬКО валидный JSON:
{"items":[{"text":"...","type":"tasks|ideas|shopping|notes","category":"..."}]}

Текст: ${text}`;

  return callLLM(env, prompt);
}