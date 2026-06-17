import type { Env, NoteItem } from '../types';
import { processNotes, retryProcessNotes } from './llm';
import { getCategoriesByUserId } from '../db/queries';
import { DEFAULT_CATEGORY_SLUG } from '../categories/defaults';

export const MAX_NOTE_ITEMS = 10;

export function extractTags(text: string): string[] {
  const matches = text.match(/#[\wа-яёА-ЯЁ]+/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.toLowerCase()))];
}

export async function parseNotes(env: Env, userId: number, text: string): Promise<NoteItem[]> {
  const categories = await getCategoriesByUserId(env, userId);
  const allowedSlugs = new Set(categories.map((category) => category.slug));
  const extractedTags = extractTags(text);

  try {
    const raw = await processNotes(env, text, categories);
    return parseLlmResponse(raw, text, extractedTags, allowedSlugs);
  } catch {
    try {
      const raw2 = await retryProcessNotes(env, text, categories);
      return parseLlmResponse(raw2, text, extractedTags, allowedSlugs);
    } catch {
      return fallback(text, extractedTags);
    }
  }
}

export function parseLlmResponse(
  raw: string,
  originalText: string,
  globalTags: string[],
  allowedSlugs: Set<string>
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
      const rawType = typeof item.type === 'string' ? item.type.trim().toLowerCase() : DEFAULT_CATEGORY_SLUG;
      const type = allowedSlugs.has(rawType) ? rawType : DEFAULT_CATEGORY_SLUG;
      const category = typeof item.category === 'string' ? item.category : type;
      const itemTags = Array.isArray(item.tags)
        ? (item.tags as string[]).filter((tag) => typeof tag === 'string')
        : [];
      const tags = [...new Set([...globalTags, ...itemTags])];
      return { text: itemText, type, category, tags };
    });
}

function fallback(text: string, tags: string[]): NoteItem[] {
  return [{ text, type: DEFAULT_CATEGORY_SLUG, category: DEFAULT_CATEGORY_SLUG, tags }];
}