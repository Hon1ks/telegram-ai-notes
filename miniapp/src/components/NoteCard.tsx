import { useState, useRef } from 'react';
import type { Note } from '../types';
import styles from './NoteCard.module.css';

interface Props {
  note: Note;
  onToggle: (id: number, done: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, text: string) => void;
}

const SWIPE_THRESHOLD = 80;

export function NoteCard({ note, onToggle, onDelete, onEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef<number | null>(null);

  // ── Swipe to delete ──
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffsetX(Math.max(dx, -SWIPE_THRESHOLD - 20));
  }

  function onTouchEnd() {
    if (offsetX < -SWIPE_THRESHOLD) {
      onDelete(note.id);
    } else {
      setOffsetX(0);
    }
    startX.current = null;
  }

  // ── Edit ──
  function handleTap() {
    if (!editing) {
      setEditing(true);
      setEditText(note.text);
    }
  }

  function handleSave() {
    if (editText.trim() && editText.trim() !== note.text) {
      onEdit(note.id, editText.trim());
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setEditText(note.text);
    }
  }

  const isDone = note.done === 1;

  return (
    <div
      className={styles.wrapper}
      style={{ transform: `translateX(${offsetX}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={`${styles.card} ${isDone ? styles.done : ''}`}>
        <button
          className={styles.checkbox}
          onClick={() => onToggle(note.id, isDone ? 0 : 1)}
          aria-label={isDone ? 'Отметить невыполненным' : 'Отметить выполненным'}
        >
          {isDone ? '✅' : '⬜'}
        </button>

        <div className={styles.content} onClick={handleTap}>
          {editing ? (
            <textarea
              className={styles.editInput}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
            />
          ) : (
            <span className={styles.text}>{note.text}</span>
          )}
          <span className={styles.date}>
            {new Date(note.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'short',
            })}
          </span>
        </div>

        <button
          className={styles.deleteBtn}
          onClick={() => onDelete(note.id)}
          aria-label="Удалить"
        >
          🗑
        </button>
      </div>

      <div className={styles.swipeHint}>Удалить</div>
    </div>
  );
}
