import { useState } from 'react';
import type { Category } from '../types';
import * as api from '../api/client';
import s from './CategoryManager.module.css';

interface Props {
  categories: Category[];
  onUpdate: () => void;
}

function slugify(name: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
    ь: '', э: 'e', ю: 'yu', я: 'ya',
  };

  const slug = name
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);

  return slug.length >= 2 ? slug : '';
}

export function CategoryManager({ categories, onUpdate }: Props) {
  const [name, setName] = useState('');
  const [hint, setHint] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editHint, setEditHint] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    const slug = slugify(value);
    if (!value || !slug || loading) return;

    setLoading(true);
    try {
      await api.createCategory({
        slug,
        name: value,
        llm_hint: hint.trim() || null,
      });
      setName('');
      setHint('');
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(id: number) {
    const value = editName.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      await api.updateCategory(id, {
        name: value,
        llm_hint: editHint.trim() || null,
      });
      setEditingId(null);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(category: Category) {
    if (category.is_system === 1) return;
    if (!confirm(`Удалить категорию «${category.name}»? Заметки перейдут в «Заметки».`)) return;
    setLoading(true);
    try {
      await api.deleteCategory(category.id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <h2 className={s.title}>Категории</h2>
      <p className={s.subtitle}>AI классифицирует заметки по этим категориям</p>

      <ul className={s.list}>
        {categories.map((category) => (
          <li key={category.id} className={s.item}>
            {editingId === category.id ? (
              <div className={s.editBox}>
                <input
                  className={s.input}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Название"
                />
                <input
                  className={s.input}
                  value={editHint}
                  onChange={(e) => setEditHint(e.target.value)}
                  placeholder="Подсказка для AI"
                />
                <div className={s.editActions}>
                  <button className={s.saveBtn} onClick={() => handleSave(category.id)}>Сохранить</button>
                  <button className={s.cancelBtn} onClick={() => setEditingId(null)}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className={s.row}>
                <span className={s.swatch} style={{ background: category.color }} />
                <div className={s.info}>
                  <span className={s.name}>{category.emoji} {category.name}</span>
                  <span className={s.slug}>#{category.slug}</span>
                  {category.note_count !== undefined && (
                    <span className={s.count}>{category.note_count} заметок</span>
                  )}
                </div>
                <div className={s.actions}>
                  <button
                    className={s.act}
                    onClick={() => {
                      setEditingId(category.id);
                      setEditName(category.name);
                      setEditHint(category.llm_hint ?? '');
                    }}
                  >
                    ✎
                  </button>
                  {category.is_system !== 1 && (
                    <button className={`${s.act} ${s.actDel}`} onClick={() => handleDelete(category)}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form className={s.form} onSubmit={handleCreate}>
        <input
          className={s.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Новая категория, например: Здоровье"
        />
        <input
          className={s.input}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Подсказка для AI (необязательно)"
        />
        <button className={s.createBtn} type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Сохранение...' : 'Добавить категорию'}
        </button>
      </form>
    </div>
  );
}