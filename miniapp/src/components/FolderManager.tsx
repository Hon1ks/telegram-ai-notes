import { useState } from 'react';
import type { Folder } from '../types';
import * as api from '../api/client';
import s from './FolderManager.module.css';

interface Props {
  folders: Folder[];
  onUpdate: () => void;
}

export function FolderManager({ folders, onUpdate }: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || loading) return;
    setLoading(true);
    try { await api.createFolder(name); setNewName(''); onUpdate(); }
    finally { setLoading(false); }
  }

  async function handleRename(id: number) {
    const name = editName.trim();
    if (!name || loading) return;
    setLoading(true);
    try { await api.updateFolder(id, name); setEditingId(null); onUpdate(); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить папку? Заметки останутся без папки.')) return;
    setLoading(true);
    try { await api.deleteFolder(id); onUpdate(); }
    finally { setLoading(false); }
  }

  return (
    <div className={s.page}>
      <h2 className={s.title}>Папки</h2>

      {folders.length === 0 ? (
        <div className={s.empty}>
          <span>📂</span>
          <p>Нет папок</p>
          <p className={s.emptyHint}>Создай первую папку ниже</p>
        </div>
      ) : (
        <ul className={s.list}>
          {folders.map(folder => (
            <li key={folder.id} className={s.item}>
              {editingId === folder.id ? (
                <div className={s.editRow}>
                  <input
                    className={s.editInput}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(folder.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button className={`${s.act} ${s.save}`} onClick={() => handleRename(folder.id)}>✓</button>
                  <button className={`${s.act} ${s.cancel}`} onClick={() => setEditingId(null)}>✕</button>
                </div>
              ) : (
                <div className={s.row}>
                  <span className={s.folderIcon}>📁</span>
                  <span className={s.name}>{folder.name}</span>
                  <div className={s.actions}>
                    <button className={s.act} onClick={() => { setEditingId(folder.id); setEditName(folder.name); }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M11.5 2.5a1.415 1.415 0 012 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button className={`${s.act} ${s.actDel}`} onClick={() => handleDelete(folder.id)}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M5.5 4V3a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1M6 7v4.5M8 7v4.5M10 7v4.5M4.5 4l.5 8.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className={s.createForm} onSubmit={handleCreate}>
        <input
          className={s.createInput}
          placeholder="Название новой папки..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          maxLength={50}
        />
        <button
          type="submit"
          className={s.createBtn}
          disabled={!newName.trim() || loading}
        >
          Создать
        </button>
      </form>
    </div>
  );
}
