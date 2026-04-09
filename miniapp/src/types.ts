export type NoteType = 'tasks' | 'ideas' | 'shopping' | 'notes';

export interface Note {
  id: number;
  user_id: number;
  folder_id: number | null;
  type: NoteType;
  text: string;
  tags: string; // JSON string: '["#работа","#личное"]'
  done: number;
  created_at: string;
}

export interface Folder {
  id: number;
  user_id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export type FilterType = 'all' | NoteType;

export function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export const TYPE_META: Record<NoteType, { label: string; emoji: string; color: string }> = {
  tasks:    { label: 'Задачи',   emoji: '✅', color: '#3b82f6' },
  ideas:    { label: 'Идеи',     emoji: '💡', color: '#f59e0b' },
  shopping: { label: 'Покупки',  emoji: '🛒', color: '#22c55e' },
  notes:    { label: 'Заметки',  emoji: '📝', color: '#8b5cf6' },
};
