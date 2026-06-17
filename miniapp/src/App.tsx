import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, Folder, Category, FilterType, NoteType } from './types';
import { buildCategoryMeta } from './types';
import * as api from './api/client';
import { FilterBar } from './components/FilterBar';
import { FolderStrip } from './components/FolderStrip';
import { NoteList } from './components/NoteList';
import { FolderManager } from './components/FolderManager';
import { CategoryManager } from './components/CategoryManager';
import { SearchBar } from './components/SearchBar';
import { Toast } from './components/Toast';
import { NoteComposer } from './components/NoteComposer';
import s from './App.module.css';

type Tab = 'notes' | 'folders';
type OrganizeView = 'folders' | 'categories';

export default function App() {
  const [tab, setTab]               = useState<Tab>('notes');
  const [filter, setFilter]         = useState<FilterType>('all');
  const [activeTag, setActiveTag]   = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [foldersVisible, setFoldersVisible] = useState(false);
  const [notes, setNotes]           = useState<Note[]>([]);
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizeView, setOrganizeView] = useState<OrganizeView>('folders');
  const [uncategorized, setUncategorized] = useState(0);
  const [tags, setTags]             = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [searching, setSearching]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const showError = useCallback((message: string) => {
    setToast(message);
  }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNotes({
        type: filter === 'all' ? undefined : filter,
        tag: activeTag ?? undefined,
        folderId: activeFolderId === null ? undefined : activeFolderId === -1 ? undefined : activeFolderId,
      });
      const filtered = activeFolderId === -1
        ? data.filter(n => n.folder_id === null)
        : data;
      setNotes(filtered);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка загрузки';
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [filter, activeTag, activeFolderId, showError]);

  const loadFolders = useCallback(async () => {
    try {
      const res = await api.getFolders();
      setFolders(res.folders);
      setUncategorized(res.uncategorized);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка загрузки папок');
    }
  }, [showError]);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await api.getCategories());
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка загрузки категорий');
    }
  }, [showError]);

  const loadTags = useCallback(async () => {
    try {
      setTags(await api.getTags());
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка загрузки тегов');
    }
  }, [showError]);

  useEffect(() => {
    if (!searching) {
      loadNotes();
      loadTags();
    }
  }, [loadNotes, loadTags, searching]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  async function refreshAll() {
    await Promise.all([loadNotes(), loadFolders(), loadTags(), loadCategories()]);
  }

  const categoryMeta = buildCategoryMeta(categories);

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchAbort.current) searchAbort.current.abort();

    if (!q.trim()) {
      loadNotes();
      return;
    }

    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      setLoading(true);
      try {
        const results = await api.searchNotes(q.trim(), controller.signal);
        if (!controller.signal.aborted) setNotes(results);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        showError(e instanceof Error ? e.message : 'Ошибка поиска');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
  }

  function openSearch()  { setSearching(true); setSearchQuery(''); }
  function closeSearch() {
    setSearching(false);
    setSearchQuery('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchAbort.current) searchAbort.current.abort();
    loadNotes();
  }

  function handleFolderSelect(id: number | null) {
    setActiveFolderId(id);
    setActiveTag(null);
  }

  async function handleToggle(id: number, done: number) {
    const prev = notes;
    setNotes(n => n.map(item => item.id === id ? { ...item, done } : item));
    try {
      const updated = await api.updateNote(id, { done });
      setNotes(n => n.map(item => item.id === id ? updated : item));
    } catch (e) {
      setNotes(prev);
      showError(e instanceof Error ? e.message : 'Не удалось обновить заметку');
    }
  }

  async function handleDelete(id: number) {
    const prev = notes;
    setNotes(n => n.filter(item => item.id !== id));
    try {
      await api.deleteNote(id);
      loadFolders();
      loadTags();
    } catch (e) {
      setNotes(prev);
      showError(e instanceof Error ? e.message : 'Не удалось удалить заметку');
    }
  }

  async function handleEdit(id: number, text: string) {
    try {
      const updated = await api.updateNote(id, { text });
      setNotes(n => n.map(item => item.id === id ? updated : item));
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось сохранить заметку');
    }
  }

  async function handleCreate(text: string, type: NoteType) {
    try {
      const note = await api.createNote({ text, type });
      setNotes(prev => [note, ...prev]);
      loadFolders();
      loadTags();
      setToast('Заметка создана');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось создать заметку');
      throw e;
    }
  }

  function handleTagClick(tag: string) {
    setActiveTag(prev => prev === tag ? null : tag);
    setFilter('all');
    setActiveFolderId(null);
    setSearching(false);
  }

  const activeFolderName = activeFolderId === null
    ? null
    : activeFolderId === -1
      ? '📥 Без папки'
      : folders.find(f => f.id === activeFolderId)?.name ?? null;

  return (
    <div className={s.app}>
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

      {tab === 'notes' && (
        <div className={s.notesView}>
          {!searching && (
            <>
              <FilterBar
                active={filter}
                onChange={f => { setFilter(f); setActiveTag(null); }}
                activeTag={activeTag}
                tags={tags}
                categories={categories}
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

          {activeFolderName && (
            <div className={s.folderBanner}>
              <span>📂 {activeFolderName}</span>
              <button className={s.bannerClose} onClick={() => setActiveFolderId(null)}>✕</button>
            </div>
          )}

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
              categoryMeta={categoryMeta}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onTagClick={handleTagClick}
            />
          )}

          <button
            className={s.fab}
            onClick={() => setComposerOpen(true)}
            aria-label="Создать заметку"
          >
            +
          </button>
        </div>
      )}

      {tab === 'folders' && (
        <div className={s.foldersView}>
          <div className={s.organizeTabs}>
            <button
              className={`${s.organizeTab} ${organizeView === 'folders' ? s.organizeTabActive : ''}`}
              onClick={() => setOrganizeView('folders')}
            >
              Папки
            </button>
            <button
              className={`${s.organizeTab} ${organizeView === 'categories' ? s.organizeTabActive : ''}`}
              onClick={() => setOrganizeView('categories')}
            >
              Категории
            </button>
          </div>
          {organizeView === 'folders' ? (
            <FolderManager folders={folders} onUpdate={loadFolders} />
          ) : (
            <CategoryManager categories={categories} onUpdate={loadCategories} />
          )}
        </div>
      )}

      <NoteComposer
        open={composerOpen}
        categories={categories}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCreate}
      />

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}