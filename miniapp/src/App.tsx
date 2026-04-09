import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, Folder, FilterType } from './types';
import * as api from './api/client';
import { FilterBar } from './components/FilterBar';
import { FolderStrip } from './components/FolderStrip';
import { NoteList } from './components/NoteList';
import { FolderManager } from './components/FolderManager';
import { SearchBar } from './components/SearchBar';
import s from './App.module.css';

type Tab = 'notes' | 'folders';

export default function App() {
  const [tab, setTab]               = useState<Tab>('notes');
  const [filter, setFilter]         = useState<FilterType>('all');
  const [activeTag, setActiveTag]   = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null); // null=все, -1=без папки
  const [foldersVisible, setFoldersVisible] = useState(false);
  const [notes, setNotes]           = useState<Note[]>([]);
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [tags, setTags]             = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [searching, setSearching]   = useState(false);
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
        // -1 means "no folder" → pass special marker; worker handles null folder_id
        folderId: activeFolderId === null ? undefined : activeFolderId === -1 ? undefined : activeFolderId,
      });
      // Client-side filter for "no folder"
      const filtered = activeFolderId === -1
        ? data.filter(n => n.folder_id === null)
        : data;
      setNotes(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filter, activeTag, activeFolderId]);

  const loadFolders = useCallback(async () => {
    try {
      const res = await api.getFolders();
      setFolders(res.folders);
      setUncategorized(res.uncategorized);
    } catch { /* ok */ }
  }, []);

  const loadTags = useCallback(async () => {
    try { setTags(await api.getTags()); } catch { /* ok */ }
  }, []);

  useEffect(() => {
    if (!searching) { loadNotes(); loadTags(); }
  }, [loadNotes, loadTags, searching]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // Reload folders after note changes to keep counts fresh
  async function refreshAll() {
    await Promise.all([loadNotes(), loadFolders(), loadTags()]);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { loadNotes(); return; }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try { setNotes(await api.searchNotes(q.trim())); }
      catch { /* ok */ }
      finally { setLoading(false); }
    }, 300);
  }

  function openSearch()  { setSearching(true); setSearchQuery(''); }
  function closeSearch() {
    setSearching(false); setSearchQuery('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    loadNotes();
  }

  // ── Folder strip ───────────────────────────────────────────────────────────

  function handleFolderSelect(id: number | null) {
    setActiveFolderId(id);
    setActiveTag(null);
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
      loadFolders(); // refresh counts
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
    setActiveFolderId(null);
    setSearching(false);
  }

  // Active folder name for banner
  const activeFolderName = activeFolderId === null
    ? null
    : activeFolderId === -1
      ? '📥 Без папки'
      : folders.find(f => f.id === activeFolderId)?.name ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={s.app}>

      {/* ── Header ── */}
      <header className={s.header}>
        {searching ? (
          <SearchBar value={searchQuery} onChange={handleSearchChange} onClose={closeSearch} />
        ) : (
          <>
            <div className={s.headerLeft}>
              <span className={s.logo}>🧠</span>
              <span className={s.logoText}>AI Notes</span>
            </div>
            <nav className={s.tabs}>
              <button
                className={`${s.tab} ${tab === 'notes' ? s.tabActive : ''}`}
                onClick={() => setTab('notes')}
              >Заметки</button>
              <button
                className={`${s.tab} ${tab === 'folders' ? s.tabActive : ''}`}
                onClick={() => setTab('folders')}
              >
                Папки
                {folders.length > 0 && <span className={s.badge}>{folders.length}</span>}
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
            <>
              <FilterBar
                active={filter}
                onChange={f => { setFilter(f); setActiveTag(null); }}
                activeTag={activeTag}
                tags={tags}
                onTagChange={t => { setActiveTag(t); setActiveFolderId(null); }}
              />

              {folders.length > 0 && (
                <FolderStrip
                  folders={folders}
                  uncategorized={uncategorized}
                  activeId={activeFolderId}
                  visible={foldersVisible}
                  onToggle={() => setFoldersVisible(v => !v)}
                  onSelect={handleFolderSelect}
                />
              )}
            </>
          )}

          {/* Active folder banner */}
          {activeFolderName && (
            <div className={s.folderBanner}>
              <span>📂 {activeFolderName}</span>
              <button className={s.bannerClose} onClick={() => setActiveFolderId(null)}>✕</button>
            </div>
          )}

          {/* Active tag banner */}
          {activeTag && !activeFolderName && (
            <div className={s.tagBanner}>
              <span>🏷 {activeTag}</span>
              <button className={s.bannerClose} onClick={() => setActiveTag(null)}>✕</button>
            </div>
          )}

          {error ? (
            <div className={s.errorBox}>
              <span>❌ {error}</span>
              <button className={s.retryBtn} onClick={refreshAll}>Повторить</button>
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
