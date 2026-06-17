import { useEffect, useState } from 'react';
import type { Note, Category, Folder, NoteType } from '../types';
import { parseTags } from '../types';
import s from './NoteEditor.module.css';

export interface NoteEditData {
  text: string;
  type: NoteType;
  folder_id: number | null;
  tags: string[];
  remind_at: string | null;
}

interface Props {
  note: Note | null;
  categories: Category[];
  folders: Folder[];
  onClose: () => void;
  onSave: (id: number, data: NoteEditData) => Promise<void>;
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function formatRemindAtForInput(value: string | null): string {
  if (!value) return '';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function remindAtFromInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function NoteEditor({ note, categories, folders, onClose, onSave }: Props) {
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>('notes');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!note) return;
    setText(note.text);
    setType(note.type);
    setFolderId(note.folder_id);
    setTagsInput(parseTags(note.tags).join(', '));
    setRemindAt(formatRemindAtForInput(note.remind_at));
  }, [note]);

  if (!note) return null;

  async function handleSave() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onSave(note!.id, {
        text: value,
        type,
        folder_id: folderId,
        tags: parseTagsInput(tagsInput),
        remind_at: remindAtFromInput(remindAt),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.overlay} onClick={onClose} role="presentation">
      <div
        className={s.sheet}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="note-editor-title"
      >
        <h2 id="note-editor-title" className={s.title}>Редактировать</h2>

        <label className={s.label} htmlFor="note-editor-text">Текст</label>
        <textarea
          id="note-editor-text"
          className={s.input}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          autoFocus
        />

        <span className={s.label}>Категория</span>
        <div className={s.types}>
          {categories.map(category => (
            <button
              key={category.slug}
              type="button"
              className={`${s.typeBtn} ${type === category.slug ? s.typeActive : ''}`}
              onClick={() => setType(category.slug)}
              aria-pressed={type === category.slug}
            >
              {category.emoji} {category.name}
            </button>
          ))}
        </div>

        <label className={s.label} htmlFor="note-editor-folder">Папка</label>
        <select
          id="note-editor-folder"
          className={s.select}
          value={folderId ?? ''}
          onChange={e => setFolderId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Без папки</option>
          {folders.map(folder => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>

        <label className={s.label} htmlFor="note-editor-tags">Теги</label>
        <input
          id="note-editor-tags"
          className={s.input}
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="работа, важное"
        />
        <span className={s.hint}>Через запятую, до 10 тегов</span>

        <label className={s.label} htmlFor="note-editor-remind">Напоминание</label>
        <input
          id="note-editor-remind"
          className={s.input}
          type="datetime-local"
          value={remindAt}
          onChange={e => setRemindAt(e.target.value)}
        />
        <span className={s.hint}>Оставь пустым, чтобы убрать напоминание</span>

        <div className={s.actions}>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            type="button"
            className={s.saveBtn}
            onClick={handleSave}
            disabled={saving || !text.trim()}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}