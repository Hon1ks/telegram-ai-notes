import type { Env } from '../types';
import { callLLM } from './llm';

/**
 * Fast pre-filter before LLM.
 * Returns false (ignore) if text is clearly not a note.
 */
export function cheapGuard(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;
  if (trimmed.startsWith('/')) return false;
  return true;
}

/**
 * LLM-based guard: determines if text is actually a note worth saving.
 * Returns true if text should be processed, false if it should be ignored.
 */
export async function llmGuard(env: Env, text: string): Promise<boolean> {
  const prompt = `Определи, является ли следующий текст заметкой, задачей, идеей или напоминанием для записи.
Если это вопрос, приветствие, диалог, команда или мусор — верни {"ignore":true}.
Если это что-то стоящее записать — верни {"ignore":false}.
Верни СТРОГО только JSON, без текста вне JSON.

Текст: ${text}`;

  try {
    const raw = await callLLM(env, prompt);
    const json = JSON.parse(raw) as { ignore: boolean };
    return !json.ignore;
  } catch {
    // При ошибке — не блокируем, пропускаем дальше
    return true;
  }
}
