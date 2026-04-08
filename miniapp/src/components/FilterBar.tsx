import type { FilterType } from '../types';
import styles from './FilterBar.module.css';

interface Props {
  active: FilterType;
  onChange: (f: FilterType) => void;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'tasks', label: '✅ Задачи' },
  { key: 'shopping', label: '🛒 Покупки' },
  { key: 'ideas', label: '💡 Идеи' },
  { key: 'notes', label: '📝 Заметки' },
];

export function FilterBar({ active, onChange }: Props) {
  return (
    <div className={styles.bar}>
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          className={`${styles.chip} ${active === key ? styles.active : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
