import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, Folder, FilterType } from './types';
import * as api from './api/client';
import { FilterBar } from './components/FilterBar';
import { NoteList } from './components/NoteList';
import { FolderManager } from './components/FolderManager';
import { SearchBar } from './components/SearchBar';
import s from './App.module.css';

type Tab = 'notes' | 'folders';

export default function App() {
  const [tab, setTab]           = useState<Tab>('notes');
  const [filter, setFilter]     = useState<FilterType>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [notes, setNotes]       = useState<Note[]>([]);
  const [folders, setFolders]   = useState<Folder[]>([]);
  const [tags, setTags]         = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNotes({
        type: filter === 'all' ? undefined : filter,
        tag: activeTag ?? undefined,
      });
      setNotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filter, activeTag]);

  const loadFolders = useCallback(async () => {
    try { setFolders(await api.getFolders()); } catch { /* ok */ }
  }, []);

  const loadTags = useCallback(async () => {
    try { setTags(await api.getTags()); } catch { /* ok */ }
  }, []);

  useEffect(() => { if (!searching) { loadNotes(); loadTags(); } }, [loadNotes, loadTags, searching]);
  useEffect(() => { loadFolders(); }, [loadFolders]);

  // ── Search ─────────────────────────────────────────────────────────────────

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { loadNotes(); return; }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchNotes(q.trim());
        setNotes(data);
      } catch { /* ok */ }
      finally { setLoading(false); }
    }, 300);
  }

  function openSearch() { setSearching(true); setSearchQuery(''); }
  function closeSearch() {
    setSearching(false);
    setSearchQuery('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    loadNotes();
  }

  // ── Note actions ───────────────────────────────────────────────────────────

  async function handleToggle(id: number, done: number) {
    try {
      const updated = await api.updateNote(id, { done });
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
    } catch { /* ok */ }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      loadTags();
    } catch { /* ok */ }
  }

  async function handleEdit(id: number, text: string) {
    try {
      const updated = await api.updateNote(id, { text });
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
    } catch { /* ok */ }
  }

  function handleTagClick(tag: string) {
    setActiveTag(prev => prev === tag ? null : tag);
    setFilter('all');
    setSearching(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={s.app}>
      {/* ── Header ── */}
      <header className={s.header}>
        {searching ? (
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            onClose={closeSearch}
          />
        ) : (
          <>
            <div className={s.headerLeft}>
              <span className={s.logo}>🧠</span>
              <span className={s.logoText}>AI Notes</span>
            </div>
            <nav className={s.tabs}>
              <button className={`${s.tab} ${tab === 'notes' ? s.tabActive : ''}`} onClick={() => setTab('notes')}>
                Заметки
              </button>
              <button className={`${s.tab} ${tab === 'folders' ? s.tabActive : ''}`} onClick={() => setTab('folders')}>
                Папки {folders.length > 0 && <span className={s.badge}>{folders.length}</span>}
              </button>
            </nav>
            <button className={s.searchBtn} onClick={openSearch} aria-label="Поиск">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.7"/>
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </button>
          </>
        )}
      </header>

      {/* ── Notes tab ── */}
      {tab === 'notes' && (
        <div className={s.notesView}>
          {!searching && (
            <FilterBar
              active={filter}
              onChange={f => { setFilter(f); setActiveTag(null); }}
              activeTag={activeTag}
              tags={tags}
              onTagChange={setActiveTag}
            />
          )}

          {activeTag && (
            <div className={s.tagBanner}>
              <span>🏷 {activeTag}</span>
              <button className={s.tagBannerClose} onClick={() => setActiveTag(null)}>✕</button>
            </div>
          )}

          {error ? (
            <div className={s.errorBox}>
              <span>❌ {error}</span>
              <button className={s.retryBtn} onClick={loadNotes}>Повторить</button>
            </div>
          ) : (
            <NoteList
              notes={notes}
              loading={loading}
              searchMode={searching && !!searchQuery}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onTagClick={handleTagClick}
            />
          )}
        </div>
      )}

      {/* ── Folders tab ── */}
      {tab === 'folders' && (
        <div className={s.foldersView}>
          <FolderManager folders={folders} onUpdate={loadFolders} />
        </div>
      )}
    </div>
  );
}
