import type { Note, Folder, FoldersResponse, NoteType } from '../types';

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
}): Promise<Note[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.folderId !== undefined) qs.set('folder_id', String(params.folderId));
  if (params?.tag) qs.set('tag', params.tag);
  const q = qs.toString();
  return request<Note[]>('GET', `/api/notes${q ? '?' + q : ''}`);
}

export function searchNotes(query: string): Promise<Note[]> {
  return request<Note[]>('GET', `/api/notes/search?q=${encodeURIComponent(query)}`);
}

export function createNote(data: {
  text: string;
  type: NoteType;
  folder_id?: number | null;
  tags?: string[];
}): Promise<Note> {
  return request<Note>('POST', '/api/notes', data);
}

export function updateNote(id: number, data: {
  text?: string;
  done?: number;
  folder_id?: number | null;
  tags?: string[];
}): Promise<Note> {
  return request<Note>('PUT', `/api/notes/${id}`, data);
}

export function deleteNote(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('DELETE', `/api/notes/${id}`);
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
