import type { Env } from '../types';
import { categorySlugExists } from '../db/queries';
import { SYSTEM_CATEGORIES } from '../categories/defaults';

export const MAX_NOTE_LENGTH = 10_000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;
export const MAX_CATEGORY_NAME_LENGTH = 40;
export const MAX_CATEGORY_HINT_LENGTH = 200;

const SYSTEM_SLUGS = new Set(SYSTEM_CATEGORIES.map((category) => category.slug));
const SLUG_RE = /^[a-z0-9_]{2,32}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isNoteType(value: unknown): value is string {
  return typeof value === 'string' && SYSTEM_SLUGS.has(value);
}

export function validateCategorySlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  return slug;
}

export function validateCategoryName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) return null;
  return name;
}

export function validateCategoryEmoji(value: unknown): string | null {
  if (value === undefined) return '📝';
  if (typeof value !== 'string') return null;
  const emoji = value.trim();
  if (!emoji || emoji.length > 8) return null;
  return emoji;
}

export function validateCategoryColor(value: unknown): string | null {
  if (value === undefined) return '#8b5cf6';
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (!COLOR_RE.test(color)) return null;
  return color.toLowerCase();
}

export function validateCategoryHint(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const hint = value.trim();
  if (!hint || hint.length > MAX_CATEGORY_HINT_LENGTH) return null;
  return hint;
}

export async function validateUserCategorySlug(
  env: Env,
  userId: number,
  slug: unknown
): Promise<string | null> {
  const normalized = validateCategorySlug(slug);
  if (!normalized) return null;
  const exists = await categorySlugExists(env, userId, normalized);
  return exists ? normalized : null;
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

export function validateRemindAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 19).replace('T', ' ');
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}