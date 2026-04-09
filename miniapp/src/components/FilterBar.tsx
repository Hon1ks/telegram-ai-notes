import type { FilterType } from '../types';
import s from './FilterBar.module.css';

interface Props {
  active: FilterType;
  onChange: (f: FilterType) => void;
  activeTag: string | null;
  tags: string[];
  onTagChange: (tag: string | null) => void;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',      label: 'Все' },
  { key: 'tasks',    label: '✅ Задачи' },
  { key: 'shopping', label: '🛒 Покупки' },
  { key: 'ideas',    label: '💡 Идеи' },
  { key: 'notes',    label: '📝 Заметки' },
];

export function FilterBar({ active, onChange, activeTag, tags, onTagChange }: Props) {
  return (
    <div className={s.wrap}>
      {/* Type filters */}
      <div className={s.row}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`${s.chip} ${active === key && !activeTag ? s.active : ''}`}
            onClick={() => { onChange(key); onTagChange(null); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tag filters */}
      {tags.length > 0 && (
        <div className={s.row}>
          {tags.map(tag => (
            <button
              key={tag}
              className={`${s.chip} ${s.tag} ${activeTag === tag ? s.tagActive : ''}`}
              onClick={() => onTagChange(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
