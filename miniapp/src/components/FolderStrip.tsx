import type { Folder } from '../types';
import s from './FolderStrip.module.css';

interface Props {
  folders: Folder[];
  uncategorized: number;
  activeId: number | null;   // null = все, -1 = без папки
  visible: boolean;
  onToggle: () => void;
  onSelect: (id: number | null) => void;
}

export function FolderStrip({ folders, uncategorized, activeId, visible, onToggle, onSelect }: Props) {
  const total = folders.reduce((s, f) => s + (f.note_count ?? 0), 0) + uncategorized;

  return (
    <div className={s.wrap}>
      {/* Toggle row */}
      <button className={s.toggle} onClick={onToggle}>
        <span className={s.toggleIcon}>📂</span>
        <span className={s.toggleLabel}>
          {activeId === null
            ? 'Все папки'
            : activeId === -1
              ? '📥 Без папки'
              : (folders.find(f => f.id === activeId)?.name ?? 'Папка')}
        </span>
        {activeId !== null && (
          <span className={s.activeCount}>
            {activeId === -1
              ? uncategorized
              : folders.find(f => f.id === activeId)?.note_count ?? 0}
          </span>
        )}
        <svg
          className={`${s.chevron} ${visible ? s.chevronOpen : ''}`}
          width="16" height="16" viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Folder list */}
      {visible && (
        <div className={s.strip}>
          <button
            className={`${s.chip} ${activeId === null ? s.active : ''}`}
            onClick={() => onSelect(null)}
          >
            📋 Все
            <span className={s.count}>{total}</span>
          </button>

          {folders.map(f => (
            <button
              key={f.id}
              className={`${s.chip} ${activeId === f.id ? s.active : ''}`}
              onClick={() => onSelect(f.id)}
            >
              📁 {f.name}
              <span className={s.count}>{f.note_count ?? 0}</span>
            </button>
          ))}

          {uncategorized > 0 && (
            <button
              className={`${s.chip} ${activeId === -1 ? s.active : ''}`}
              onClick={() => onSelect(-1)}
            >
              📥 Без папки
              <span className={s.count}>{uncategorized}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
