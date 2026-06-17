import { useEffect, useState } from 'react';
import type { Category, NoteType } from '../types';
import s from './NoteComposer.module.css';

interface Props {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onSubmit: (text: string, type: NoteType) => Promise<void>;
}

export function NoteComposer({ open, categories, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>('notes');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && categories.length > 0 && !categories.some((c) => c.slug === type)) {
      setType(categories[0]?.slug ?? 'notes');
    }
  }, [open, categories, type]);

  if (!open) return null;

  async function handleSubmit() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onSubmit(value, type);
      setText('');
      setType(categories[0]?.slug ?? 'notes');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.sheet} onClick={e => e.stopPropagation()}>
        <h2 className={s.title}>Новая заметка</h2>
        <div className={s.types}>
          {categories.map((category) => (
            <button
              key={category.slug}
              className={`${s.typeBtn} ${type === category.slug ? s.typeActive : ''}`}
              onClick={() => setType(category.slug)}
            >
              {category.emoji} {category.name}
            </button>
          ))}
        </div>
        <textarea
          className={s.input}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Текст заметки..."
          rows={4}
          autoFocus
        />
        <div className={s.actions}>
          <button className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={s.saveBtn} onClick={handleSubmit} disabled={saving || !text.trim()}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}