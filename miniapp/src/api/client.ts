import type { Note, Folder, FoldersResponse, NoteType, Category } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function getInitData(): string {
  return window.Telegram?.WebApp?.initData ?? '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `tma ${getInitData()}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function getNotes(params?: {
  type?: NoteType;
  folderId?: number;
  tag?: string;
  limit?: number;
  offset?: number;
  trash?: boolean;
}): Promise<Note[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.folderId !== undefined) qs.set('folder_id', String(params.folderId));
  if (params?.tag) qs.set('tag', params.tag);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.trash) qs.set('trash', '1');
  const q = qs.toString();
  return request<Note[]>('GET', `/api/notes${q ? '?' + q : ''}`);
}

export function searchNotes(query: string, signal?: AbortSignal): Promise<Note[]> {
  return fetch(`${API_URL}/api/notes/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `tma ${getInitData()}`,
    },
    signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<Note[]>;
  });
}

export function createNote(data: {
  text: string;
  type: NoteType;
  folder_id?: number | null;
  tags?: string[];
  remind_at?: string | null;
}): Promise<Note> {
  return request<Note>('POST', '/api/notes', data);
}

export function updateNote(id: number, data: {
  text?: string;
  done?: number;
  folder_id?: number | null;
  tags?: string[];
  type?: NoteType;
  remind_at?: string | null;
}): Promise<Note> {
  return request<Note>('PUT', `/api/notes/${id}`, data);
}

export function deleteNote(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('DELETE', `/api/notes/${id}`);
}

export function restoreNote(id: number): Promise<Note> {
  return request<Note>('POST', `/api/notes/${id}/restore`);
}

export function permanentDeleteNote(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('DELETE', `/api/notes/${id}/permanent`);
}

export async function exportNotes(format: 'json' | 'md'): Promise<void> {
  const res = await fetch(`${API_URL}/api/export?format=${format}`, {
    method: 'GET',
    headers: {
      Authorization: `tma ${getInitData()}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = format === 'md' ? 'notes-export.md' : 'notes-export.json';
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export function getFolders(): Promise<FoldersResponse> {
  return request<FoldersResponse>('GET', '/api/folders');
}

export function createFolder(name: string): Promise<Folder> {
  return request<Folder>('POST', '/api/folders', { name });
}

export function updateFolder(id: number, name: string): Promise<Folder> {
  return request<Folder>('PUT', `/api/folders/${id}`, { name });
}

export function deleteFolder(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('DELETE', `/api/folders/${id}`);
}

export function reorderFolders(ids: number[]): Promise<Folder[]> {
  return request<Folder[]>('POST', '/api/folders/reorder', { ids });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function getTags(): Promise<string[]> {
  return request<string[]>('GET', '/api/tags');
}

// ─── Categories ──────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return request<Category[]>('GET', '/api/categories');
}

export function createCategory(data: {
  slug: string;
  name: string;
  emoji?: string;
  color?: string;
  llm_hint?: string | null;
}): Promise<Category> {
  return request<Category>('POST', '/api/categories', data);
}

export function updateCategory(id: number, data: {
  name?: string;
  emoji?: string;
  color?: string;
  llm_hint?: string | null;
}): Promise<Category> {
  return request<Category>('PUT', `/api/categories/${id}`, data);
}

export function deleteCategory(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('DELETE', `/api/categories/${id}`);
}
