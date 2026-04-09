import type { Note } from '../types';
import { NoteCard } from './NoteCard';
import s from './NoteList.module.css';

interface Props {
  notes: Note[];
  loading: boolean;
  searchMode: boolean;
  onToggle: (id: number, done: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, text: string) => void;
  onTagClick?: (tag: string) => void;
}

export function NoteList({ notes, loading, searchMode, onToggle, onDelete, onEdit, onTagClick }: Props) {
  if (loading) {
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
              ? 'Попробуй другой запрос'
              : 'Отправь голосовое или текстовое сообщение боту — я классифицирую и сохраню'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.list}>
      {notes.map(note => (
        <NoteCard
          key={note.id}
          note={note}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          onTagClick={onTagClick}
        />
      ))}
      <div className={s.listPad} />
    </div>
  );
}
