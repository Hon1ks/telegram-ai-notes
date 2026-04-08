export type NoteType = 'tasks' | 'ideas' | 'shopping' | 'notes';

export interface Note {
  id: number;
  user_id: number;
  folder_id: number | null;
  type: NoteType;
  text: string;
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
