import type { Env } from '../types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'stepfun/step-3.5-flash:free';

/**
 * Base LLM call via OpenRouter.
 * Returns raw string content from the model.
 */
export async function callLLM(env: Env, prompt: string): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://notes-bot.workers.dev',
      'X-Title': 'AI Notes Bot',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  return extractJson(content);
}

/**
 * Extracts JSON from model response (strips markdown code blocks if present).
 */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  // Strip ```json ... ``` or ``` ... ```
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

Раздели текст на части, классифицируй каждую. Верни ТОЛЬКО валидный JSON:
{"items":[{"text":"...","type":"tasks|ideas|shopping|notes","category":"..."}]}

Текст: ${text}`;

  return callLLM(env, prompt);
}
