import type { Env, NoteItem, NoteType } from '../types';
import { processNotes, retryProcessNotes } from './llm';

export const MAX_NOTE_ITEMS = 10;

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

  try {
    const raw = await processNotes(env, text);
    return parseLlmResponse(raw, text, extractedTags);
  } catch {
    try {
      const raw2 = await retryProcessNotes(env, text);
      return parseLlmResponse(raw2, text, extractedTags);
    } catch {
      return fallback(text, extractedTags);
    }
  }
}

export function parseLlmResponse(
  raw: string,
  originalText: string,
  globalTags: string[]
): NoteItem[] {
  let parsed: { items?: unknown };

  try {
    parsed = JSON.parse(raw) as { items?: unknown };
  } catch {
    throw new Error('Invalid JSON from LLM');
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('Empty or missing items array');
  }

  return (parsed.items as Array<Record<string, unknown>>)
    .slice(0, MAX_NOTE_ITEMS)
    .map((item) => {
      const itemText = typeof item.text === 'string' ? item.text.trim() : originalText;
      const type = isValidType(item.type) ? item.type : 'notes';
      const category = typeof item.category === 'string' ? item.category : type;
      const itemTags = Array.isArray(item.tags)
        ? (item.tags as string[]).filter(t => typeof t === 'string')
        : [];
      const tags = [...new Set([...globalTags, ...itemTags])];
      return { text: itemText, type, category, tags };
    });
}

function isValidType(v: unknown): v is NoteType {
  return v === 'tasks' || v === 'ideas' || v === 'shopping' || v === 'notes';
}

function fallback(text: string, tags: string[]): NoteItem[] {
  return [{ text, type: 'notes', category: 'notes', tags }];
}