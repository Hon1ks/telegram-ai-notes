import { useState } from 'react';
import type { NoteType } from '../types';
import s from './NoteComposer.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string, type: NoteType) => Promise<void>;
}

const TYPES: Array<{ id: NoteType; label: string }> = [
  { id: 'notes', label: '📝 Заметка' },
  { id: 'tasks', label: '✅ Задача' },
  { id: 'ideas', label: '💡 Идея' },
  { id: 'shopping', label: '🛒 Покупка' },
];

export function NoteComposer({ open, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>('notes');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onSubmit(value, type);
      setText('');
      setType('notes');
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
          {TYPES.map(item => (
            <button
              key={item.id}
              className={`${s.typeBtn} ${type === item.id ? s.typeActive : ''}`}
              onClick={() => setType(item.id)}
            >
              {item.label}
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