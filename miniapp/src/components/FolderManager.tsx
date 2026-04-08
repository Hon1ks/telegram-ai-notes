import { useState } from 'react';
import type { Folder } from '../types';
import * as api from '../api/client';
import styles from './FolderManager.module.css';

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
    try {
      await api.createFolder(name);
      setNewName('');
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(id: number) {
    const name = editName.trim();
    if (!name || loading) return;

    setLoading(true);
    try {
      await api.updateFolder(id, name);
      setEditingId(null);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить папку? Заметки останутся.')) return;
    setLoading(true);
    try {
      await api.deleteFolder(id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  function startEdit(folder: Folder) {
    setEditingId(folder.id);
    setEditName(folder.name);
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📂 Папки</h2>

      <ul className={styles.list}>
        {folders.map((folder) => (
          <li key={folder.id} className={styles.item}>
            {editingId === folder.id ? (
              <div className={styles.editRow}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(folder.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                />
                <button className={styles.saveBtn} onClick={() => handleRename(folder.id)}>✓</button>
                <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>✕</button>
              </div>
            ) : (
              <div className={styles.folderRow}>
                <span className={styles.folderName}>📁 {folder.name}</span>
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => startEdit(folder)}>✏️</button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(folder.id)}>🗑</button>
                </div>
              </div>
            )}
          </li>
        ))}

        {folders.length === 0 && (
          <li className={styles.empty}>Нет папок</li>
        )}
      </ul>

      <form className={styles.createForm} onSubmit={handleCreate}>
        <input
          placeholder="Название новой папки..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={50}
        />
        <button
          type="submit"
          className={styles.createBtn}
          disabled={!newName.trim() || loading}
        >
          + Добавить
        </button>
      </form>
    </div>
  );
}
