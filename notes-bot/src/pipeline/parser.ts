import type { Env, NoteItem } from '../types';
import { processNotes, retryProcessNotes } from './llm';

/**
 * Extracts #hashtags from raw text using regex.
 */
export function extractTags(text: string): string[] {
  const matches = text.match(/#[\wа-яёА-ЯЁ]+/gu) ?? [];
  return [...new Set(matches.map(t => t.toLowerCase()))];
}

/**
 * Parses LLM output into NoteItem[].
 * Implements retry on invalid JSON, then fallback.
 */
export async function parseNotes(env: Env, text: string): Promise<NoteItem[]> {
  const extractedTags = extractTags(text);

  // Attempt 1
  try {
    const raw = await processNotes(env, text);
    return extractItems(raw, text, extractedTags);
  } catch {
    // Attempt 2 — retry with correction prompt
    try {
      const raw2 = await retryProcessNotes(env, text);
      return extractItems(raw2, text, extractedTags);
    } catch {
      return fallback(text, extractedTags);
    }
  }
}

function extractItems(raw: string, originalText: string, globalTags: string[]): NoteItem[] {
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
    // Merge global tags (from full text) with per-item tags if LLM returns them
    const itemTags = Array.isArray(item.tags)
      ? (item.tags as string[]).filter(t => typeof t === 'string')
      : [];
    const tags = [...new Set([...globalTags, ...itemTags])];
    return { text, type, category, tags };
  });
}

function isValidType(v: unknown): v is NoteItem['type'] {
  return v === 'tasks' || v === 'ideas' || v === 'shopping' || v === 'notes';
}

function fallback(text: string, tags: string[]): NoteItem[] {
  return [{ text, type: 'notes', category: 'notes', tags }];
}
