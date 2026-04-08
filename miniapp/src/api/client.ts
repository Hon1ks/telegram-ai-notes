import type { Note, Folder, NoteType } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function getInitData(): string {
  return window.Telegram?.WebApp?.initData ?? '';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
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

export function getNotes(type?: NoteType, folderId?: number): Promise<Note[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (folderId !== undefined) params.set('folder_id', String(folderId));
  const qs = params.toString();
  return request<Note[]>('GET', `/api/notes${qs ? '?' + qs : ''}`);
}

export function createNote(data: { text: string; type: NoteType; folder_id?: number | null }): Promise<Note> {
  return request<Note>('POST', '/api/notes', data);
}

export function updateNote(id: number, data: { text?: string; done?: number; folder_id?: number | null }): Promise<Note> {
  return request<Note>('PUT', `/api/notes/${id}`, data);
}

export function deleteNote(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('DELETE', `/api/notes/${id}`);
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export function getFolders(): Promise<Folder[]> {
  return request<Folder[]>('GET', '/api/folders');
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
