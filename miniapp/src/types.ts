export type NoteType = string;

export interface Category {
  id: number;
  user_id: number;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  llm_hint: string | null;
  is_system: number;
  sort_order: number;
  note_count?: number;
  created_at: string;
}

export interface Note {
  id: number;
  user_id: number;
  folder_id: number | null;
  type: NoteType;
  text: string;
  tags: string;
  done: number;
  deleted_at: string | null;
  remind_at: string | null;
  created_at: string;
}

export interface Folder {
  id: number;
  user_id: number;
  name: string;
  category?: string | null;
  sort_order: number;
  note_count: number;
  created_at: string;
}

export interface FoldersResponse {
  folders: Folder[];
  uncategorized: number;
}

export type FilterType = 'all' | string;

export function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function buildCategoryMeta(categories: Category[]): Record<string, { label: string; emoji: string; color: string }> {
  const meta: Record<string, { label: string; emoji: string; color: string }> = {};
  for (const category of categories) {
    meta[category.slug] = {
      label: category.name,
      emoji: category.emoji,
      color: category.color,
    };
  }
  return meta;
}

export const FALLBACK_CATEGORY_META = {
  label: 'Заметки',
  emoji: '📝',
  color: '#8b5cf6',
};