import type { Env, NoteItem } from '../types';
import { processNotes, retryProcessNotes } from './llm';

/**
 * Parses LLM output into NoteItem[].
 * Implements retry on invalid JSON, then fallback.
 */
export async function parseNotes(env: Env, text: string): Promise<NoteItem[]> {
  // Attempt 1
  try {
    const raw = await processNotes(env, text);
    return extractItems(raw, text);
  } catch {
    // Attempt 2 — retry with correction prompt
    try {
      const raw2 = await retryProcessNotes(env, text);
      return extractItems(raw2, text);
    } catch {
      // Fallback — save as raw note
      return fallback(text);
    }
  }
}

function extractItems(raw: string, originalText: string): NoteItem[] {
  let parsed: { items?: unknown };

  try {
    parsed = JSON.parse(raw) as { items?: unknown };
  } catch {
    throw new Error('Invalid JSON from LLM');
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('Empty or missing items array');
  }

  return (parsed.items as Array<Record<string, unknown>>).map((item) => {
    const text = typeof item.text === 'string' ? item.text.trim() : originalText;
    const type = isValidType(item.type) ? item.type : 'notes';
    const category = typeof item.category === 'string' ? item.category : type;
    return { text, type, category };
  });
}

function isValidType(v: unknown): v is NoteItem['type'] {
  return v === 'tasks' || v === 'ideas' || v === 'shopping' || v === 'notes';
}

function fallback(text: string): NoteItem[] {
  return [{ text, type: 'notes', category: 'notes' }];
}
