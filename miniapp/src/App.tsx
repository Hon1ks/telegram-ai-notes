import { useState, useEffect, useCallback } from 'react';
import type { Note, Folder, FilterType } from './types';
import * as api from './api/client';
import { FilterBar } from './components/FilterBar';
import { NoteList } from './components/NoteList';
import { FolderManager } from './components/FolderManager';
import styles from './App.module.css';

type Tab = 'notes' | 'folders';

export default function App() {
  const [tab, setTab] = useState<Tab>('notes');
  const [filter, setFilter] = useState<FilterType>('all');
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNotes(filter === 'all' ? undefined : filter);
      setNotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadFolders = useCallback(async () => {
    try {
      const data = await api.getFolders();
      setFolders(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  async function handleToggle(id: number, done: number) {
    try {
      const updated = await api.updateNote(id, { done });
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleEdit(id: number, text: string) {
    try {
      const updated = await api.updateNote(id, { text });
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch {
      // ignore
    }
  }

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.logo}>🧠 AI Notes</h1>
        <nav className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'notes' ? styles.tabActive : ''}`}
            onClick={() => setTab('notes')}
          >
            Заметки
          </button>
          <button
            className={`${styles.tab} ${tab === 'folders' ? styles.tabActive : ''}`}
            onClick={() => setTab('folders')}
          >
            Папки
          </button>
        </nav>
      </header>

      {/* Content */}
      {tab === 'notes' ? (
        <div className={styles.notesView}>
          <FilterBar active={filter} onChange={(f) => setFilter(f)} />

          {error ? (
            <div className={styles.error}>
              ❌ {error}
              <button onClick={loadNotes} className={styles.retryBtn}>Повторить</button>
            </div>
          ) : (
            <NoteList
              notes={notes}
              loading={loading}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          )}
        </div>
      ) : (
        <div className={styles.foldersView}>
          <FolderManager
            folders={folders}
            onUpdate={() => { loadFolders(); }}
          />
        </div>
      )}
    </div>
  );
}
