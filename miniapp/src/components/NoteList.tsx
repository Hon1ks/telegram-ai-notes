import { useRef, useState } from 'react';
import type { Note } from '../types';
import { NoteCard } from './NoteCard';
import s from './NoteList.module.css';

interface Props {
  notes: Note[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  searchMode: boolean;
  categoryMeta: Record<string, { label: string; emoji: string; color: string }>;
  onToggle: (id: number, done: number) => void;
  onDelete: (id: number) => void;
  onEdit: (note: Note) => void;
  onTagClick?: (tag: string) => void;
  onLoadMore: () => void;
  onRefresh: () => Promise<void>;
}

const PULL_THRESHOLD = 64;

export function NoteList({
  notes,
  loading,
  loadingMore,
  hasMore,
  searchMode,
  categoryMeta,
  onToggle,
  onDelete,
  onEdit,
  onTagClick,
  onLoadMore,
  onRefresh,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const pulling = useRef(false);

  function handleScroll() {
    const el = listRef.current;
    if (!el || loading || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      onLoadMore();
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    const el = listRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    touchStartY.current = e.touches[0].clientY;
    pulling.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current || touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.5, 80));
  }

  async function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    touchStartY.current = null;
    if (pullY >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullY(0);
  }

  if (loading && notes.length === 0) {
    return (
      <div className={s.center}>
        <div className={s.skeleton}>
          {[1, 2, 3].map(i => <div key={i} className={s.skeletonCard} />)}
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={s.center}>
        <div className={s.empty}>
          <span className={s.emptyIcon}>{searchMode ? '🔍' : '📭'}</span>
          <p className={s.emptyTitle}>{searchMode ? 'Ничего не найдено' : 'Заметок пока нет'}</p>
          <p className={s.emptyHint}>
            {searchMode
              ? 'Попробуй другой запрос или смени фильтр'
              : 'Отправь голосовое или текстовое сообщение боту — я классифицирую и сохраню'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={s.list}
      onScroll={handleScroll}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label="Список заметок"
    >
      {(pullY > 0 || refreshing) && (
        <div className={s.pullIndicator} style={{ height: pullY || 32 }}>
          <span>{refreshing ? 'Обновление...' : pullY >= PULL_THRESHOLD ? 'Отпусти' : 'Потяни вниз'}</span>
        </div>
      )}

      {notes.map(note => (
        <NoteCard
          key={note.id}
          note={note}
          categoryMeta={categoryMeta}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          onTagClick={onTagClick}
        />
      ))}

      {loadingMore && (
        <div className={s.loadMore}>
          <div className={s.spinner} aria-hidden="true" />
          <span>Загрузка...</span>
        </div>
      )}

      {!hasMore && notes.length > 0 && !searchMode && (
        <p className={s.endHint}>Все заметки загружены</p>
      )}

      <div className={s.listPad} />
    </div>
  );
}