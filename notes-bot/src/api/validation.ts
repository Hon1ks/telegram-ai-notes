import type { NoteType } from '../types';

export const MAX_NOTE_LENGTH = 10_000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

const NOTE_TYPES = new Set<NoteType>(['tasks', 'ideas', 'shopping', 'notes']);

export function isNoteType(value: unknown): value is NoteType {
  return typeof value === 'string' && NOTE_TYPES.has(value as NoteType);
}

export function parsePositiveInt(value: string | null): number | undefined {
  if (value === null || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function validateNoteText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > MAX_NOTE_LENGTH) return null;
  return text;
}

export function validateFolderId(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

export function validateTags(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;

  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const tag = item.trim().toLowerCase();
    if (!tag || tag.length > MAX_TAG_LENGTH) return null;
    tags.push(tag.startsWith('#') ? tag : `#${tag}`);
  }

  return [...new Set(tags)];
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}
