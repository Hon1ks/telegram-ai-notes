import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, Folder, Category, FilterType, NoteType } from './types';
import { buildCategoryMeta, parseTags } from './types';
import * as api from './api/client';
import { FilterBar } from './components/FilterBar';
import { FolderStrip } from './components/FolderStrip';
import { NoteList } from './components/NoteList';
import { FolderManager } from './components/FolderManager';
import { CategoryManager } from './components/CategoryManager';
import { SearchBar } from './components/SearchBar';
import { Toast, type ToastState } from './components/Toast';
import { NoteComposer } from './components/NoteComposer';
import { NoteEditor, type NoteEditData } from './components/NoteEditor';
import s from './App.module.css';

const PAGE_SIZE = 30;

type Tab = 'notes' | 'folders';
type OrganizeView = 'folders' | 'categories';

function applyNoteFilters(
  items: Note[],
  filter: FilterType,
  activeTag: string | null,
  activeFolderId: number | null,
): Note[] {
  let result = items;
  if (filter !== 'all') result = result.filter(n => n.type === filter);
  if (activeTag) result = result.filter(n => parseTags(n.tags).includes(activeTag));
  if (activeFolderId === -1) result = result.filter(n => n.folder_id === null);
  else if (activeFolderId !== null) result = result.filter(n => n.folder_id === activeFolderId);
  return result;
}

export default function App() {
  const [tab, setTab]               = useState<Tab>('notes');
  const [filter, setFilter]         = useState<FilterType>('all');
  const [activeTag, setActiveTag]   = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [foldersVisible, setFoldersVisible] = useState(false);
  const [notes, setNotes]           = useState<Note[]>([]);
  const [hasMore, setHasMore]       = useState(true);
  const [offset, setOffset]         = useState(0);
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizeView, setOrganizeView] = useState<OrganizeView>('folders');
  const [uncategorized, setUncategorized] = useState(0);
  const [tags, setTags]             = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<ToastState | null>(null);
  const [searching, setSearching]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const showError = useCallback((message: string) => {
    setToast({ message });
  }, []);

  const fetchNotesPage = useCallback(async (pageOffset: number) => {
    const data = await api.getNotes({
      type: filter === 'all' ? undefined : filter,
      tag: activeTag ?? undefined,
      folderId: activeFolderId === null || activeFolderId === -1
        ? undefined
        : activeFolderId,
      limit: PAGE_SIZE,
      offset: pageOffset,
    });
    return activeFolderId === -1
      ? data.filter(n => n.folder_id === null)
      : data;
  }, [filter, activeTag, activeFolderId]);

  const loadNotes = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const pageOffset = reset ? 0 : offset;
      const data = await fetchNotesPage(pageOffset);
      if (reset) {
        setNotes(data);
        setOffset(data.length);
      } else {
        setNotes(prev => [...prev, ...data]);
        setOffset(prev => prev + data.length);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка загрузки';
      if (reset) setError(message);
      showError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchNotesPage, offset, showError]);

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
      loadNotes(true);
      loadTags();
    }
  }, [filter, activeTag, activeFolderId, searching]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  async function refreshAll() {
    await Promise.all([
      loadNotes(true),
      loadFolders(),
      loadTags(),
      loadCategories(),
    ]);
  }

  const categoryMeta = buildCategoryMeta(categories);

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchAbort.current) searchAbort.current.abort();

    if (!q.trim()) {
      setSearching(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      setLoading(true);
      try {
        const results = await api.searchNotes(q.trim(), controller.signal);
        if (!controller.signal.aborted) {
          setNotes(applyNoteFilters(results, filter, activeTag, activeFolderId));
          setHasMore(false);
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        showError(e instanceof Error ? e.message : 'Ошибка поиска');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
  }

  function openSearch() {
    setSearching(true);
    setSearchQuery('');
    setNotes([]);
  }

  function closeSearch() {
    setSearching(false);
    setSearchQuery('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchAbort.current) searchAbort.current.abort();
    loadNotes(true);
  }

  // Re-apply filters when they change during active search
  useEffect(() => {
    if (!searching || !searchQuery.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => handleSearchChange(searchQuery), 100);
  }, [filter, activeTag, activeFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const note = notes.find(item => item.id === id);
    if (!note) return;
    const prev = notes;
    setNotes(n => n.filter(item => item.id !== id));
    try {
      await api.deleteNote(id);
      loadFolders();
      loadTags();
      setToast({
        message: 'Заметка удалена',
        duration: 5000,
        action: {
          label: 'Отменить',
          onClick: async () => {
            try {
              const restored = await api.createNote({
                text: note.text,
                type: note.type,
                folder_id: note.folder_id,
                tags: parseTags(note.tags),
              });
              setNotes(n => [restored, ...n]);
              loadFolders();
              loadTags();
            } catch (e) {
              showError(e instanceof Error ? e.message : 'Не удалось восстановить');
            }
          },
        },
      });
    } catch (e) {
      setNotes(prev);
      showError(e instanceof Error ? e.message : 'Не удалось удалить заметку');
    }
  }

  async function handleSaveEdit(id: number, data: NoteEditData) {
    try {
      const updated = await api.updateNote(id, data);
      setNotes(n => n.map(item => item.id === id ? updated : item));
      loadFolders();
      loadTags();
      setToast({ message: 'Заметка сохранена' });
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось сохранить заметку');
      throw e;
    }
  }

  async function handleCreate(text: string, type: NoteType) {
    try {
      const note = await api.createNote({ text, type });
      setNotes(prev => [note, ...prev]);
      loadFolders();
      loadTags();
      setToast({ message: 'Заметка создана' });
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось создать заметку');
      throw e;
    }
  }

  function handleTagClick(tag: string) {
    setActiveTag(prev => prev === tag ? null : tag);
    setFilter('all');
    setActiveFolderId(null);
    if (searching) setSearching(false);
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
              <span className={s.logo} aria-hidden="true">🧠</span>
              <span className={s.logoText}>AI Notes</span>
            </div>
            <nav className={s.tabs} aria-label="Разделы">
              <button
                type="button"
                className={`${s.tab} ${tab === 'notes' ? s.tabActive : ''}`}
                onClick={() => setTab('notes')}
                aria-current={tab === 'notes' ? 'page' : undefined}
              >Заметки</button>
              <button
                type="button"
                className={`${s.tab} ${tab === 'folders' ? s.tabActive : ''}`}
                onClick={() => setTab('folders')}
                aria-current={tab === 'folders' ? 'page' : undefined}
              >
                Папки
                {folders.length > 0 && <span className={s.badge}>{folders.length}</span>}
              </button>
            </nav>
            <button
              type="button"
              className={s.searchBtn}
              onClick={openSearch}
              aria-label="Поиск заметок"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.7"/>
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </button>
          </>
        )}
      </header>

      {tab === 'notes' && (
        <div className={s.notesView}>
          <FilterBar
            active={filter}
            onChange={f => { setFilter(f); setActiveTag(null); }}
            activeTag={activeTag}
            tags={tags}
            categories={categories}
            onTagChange={t => { setActiveTag(t); setActiveFolderId(null); }}
          />

          {folders.length > 0 && !searching && (
            <FolderStrip
              folders={folders}
              uncategorized={uncategorized}
              activeId={activeFolderId}
              visible={foldersVisible}
              onToggle={() => setFoldersVisible(v => !v)}
              onSelect={handleFolderSelect}
            />
          )}

          {activeFolderName && (
            <div className={s.folderBanner}>
              <span>📂 {activeFolderName}</span>
              <button
                type="button"
                className={s.bannerClose}
                onClick={() => setActiveFolderId(null)}
                aria-label="Сбросить фильтр папки"
              >✕</button>
            </div>
          )}

          {activeTag && !activeFolderName && (
            <div className={s.tagBanner}>
              <span>🏷 {activeTag}</span>
              <button
                type="button"
                className={s.bannerClose}
                onClick={() => setActiveTag(null)}
                aria-label="Сбросить фильтр тега"
              >✕</button>
            </div>
          )}

          {searching && searchQuery && (
            <div className={s.searchBanner}>
              <span>🔍 «{searchQuery}»</span>
            </div>
          )}

          {error ? (
            <div className={s.errorBox}>
              <span>❌ {error}</span>
              <button type="button" className={s.retryBtn} onClick={refreshAll}>Повторить</button>
            </div>
          ) : (
            <NoteList
              notes={notes}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore && !searching}
              searchMode={searching && !!searchQuery}
              categoryMeta={categoryMeta}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={setEditingNote}
              onTagClick={handleTagClick}
              onLoadMore={() => loadNotes(false)}
              onRefresh={refreshAll}
            />
          )}

          <button
            type="button"
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
          <div className={s.organizeTabs} role="tablist" aria-label="Организация">
            <button
              type="button"
              role="tab"
              aria-selected={organizeView === 'folders'}
              className={`${s.organizeTab} ${organizeView === 'folders' ? s.organizeTabActive : ''}`}
              onClick={() => setOrganizeView('folders')}
            >
              Папки
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={organizeView === 'categories'}
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

      <NoteEditor
        note={editingNote}
        categories={categories}
        folders={folders}
        onClose={() => setEditingNote(null)}
        onSave={handleSaveEdit}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}