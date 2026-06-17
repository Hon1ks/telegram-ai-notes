import type { Category, FilterType } from '../types';
import s from './FilterBar.module.css';

interface Props {
  active: FilterType;
  onChange: (f: FilterType) => void;
  activeTag: string | null;
  tags: string[];
  categories: Category[];
  onTagChange: (tag: string | null) => void;
}

export function FilterBar({ active, onChange, activeTag, tags, categories, onTagChange }: Props) {
  return (
    <div className={s.wrap}>
      <div className={s.row}>
        <button
          className={`${s.chip} ${active === 'all' && !activeTag ? s.active : ''}`}
          onClick={() => { onChange('all'); onTagChange(null); }}
        >
          Все
        </button>
        {categories.map((category) => (
          <button
            key={category.slug}
            className={`${s.chip} ${active === category.slug && !activeTag ? s.active : ''}`}
            onClick={() => { onChange(category.slug); onTagChange(null); }}
          >
            {category.emoji} {category.name}
          </button>
        ))}
      </div>

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