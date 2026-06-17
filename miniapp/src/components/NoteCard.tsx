import { useRef, useState } from 'react';
import type { Note } from '../types';
import { parseTags, FALLBACK_CATEGORY_META } from '../types';
import s from './NoteCard.module.css';

interface Props {
  note: Note;
  categoryMeta: Record<string, { label: string; emoji: string; color: string }>;
  onToggle: (id: number, done: number) => void;
  onDelete: (id: number) => void;
  onEdit: (note: Note) => void;
  onTagClick?: (tag: string) => void;
}

const SWIPE_THRESHOLD = 72;

export function NoteCard({ note, categoryMeta, onToggle, onDelete, onEdit, onTagClick }: Props) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef<number | null>(null);
  const tags = parseTags(note.tags);
  const meta = categoryMeta[note.type] ?? FALLBACK_CATEGORY_META;
  const isDone = note.done === 1;

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setSwiping(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) > 8) setSwiping(true);
    if (dx < 0) setOffsetX(Math.max(dx, -(SWIPE_THRESHOLD + 24)));
  }

  function onTouchEnd() {
    if (offsetX < -SWIPE_THRESHOLD) onDelete(note.id);
    else setOffsetX(0);
    startX.current = null;
  }

  function handleTap() {
    if (swiping) return;
    onEdit(note);
  }

  const date = new Date(note.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short',
  });

  return (
    <div className={s.wrap}>
      <div className={s.deleteHint} style={{ opacity: Math.min(-offsetX / SWIPE_THRESHOLD, 1) }}>
        <span>🗑</span>
      </div>

      <div
        className={`${s.card} ${isDone ? s.done : ''}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? `transform ${swiping ? '0ms' : '200ms'} ease` : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={s.accent} style={{ background: meta.color }} />

        <div className={s.body}>
          <div className={s.top}>
            <button
              type="button"
              className={`${s.check} ${isDone ? s.checked : ''}`}
              onClick={() => onToggle(note.id, isDone ? 0 : 1)}
              aria-label={isDone ? 'Снять отметку' : 'Отметить выполненным'}
            >
              {isDone ? '✅' : <span className={s.circle} />}
            </button>

            <div
              className={s.content}
              onClick={handleTap}
              onKeyDown={e => { if (e.key === 'Enter') handleTap(); }}
              role="button"
              tabIndex={0}
              aria-label="Редактировать заметку"
            >
              <span className={s.text}>{note.text}</span>
            </div>

            <button
              type="button"
              className={s.del}
              onClick={() => onDelete(note.id)}
              aria-label="Удалить заметку"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4h10M5.5 4V3a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1M6 7v4.5M8 7v4.5M10 7v4.5M4.5 4l.5 8.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className={s.bottom}>
            <div className={s.meta}>
              <span className={s.category} style={{ color: meta.color }}>
                {meta.emoji} {meta.label}
              </span>
              {tags.length > 0 && (
                <div className={s.tags}>
                  {tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={s.tag}
                      onClick={e => { e.stopPropagation(); onTagClick?.(tag); }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className={s.date}>{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}