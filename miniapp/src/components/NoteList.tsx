import type { Note } from '../types';
import { NoteCard } from './NoteCard';
import styles from './NoteList.module.css';

interface Props {
  notes: Note[];
  loading: boolean;
  onToggle: (id: number, done: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, text: string) => void;
}

export function NoteList({ notes, loading, onToggle, onDelete, onEdit }: Props) {
  if (loading) {
    return (
      <div className={styles.empty}>
        <span className={styles.spinner}>⏳</span>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.icon}>📭</span>
        <p>Заметок пока нет</p>
        <p className={styles.hint}>Отправь голосовое или текстовое сообщение боту</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
