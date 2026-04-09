import { useEffect, useRef } from 'react';
import s from './SearchBar.module.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

export function SearchBar({ value, onChange, onClose }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className={s.bar}>
      <span className={s.icon}>🔍</span>
      <input
        ref={ref}
        className={s.input}
        placeholder="Поиск заметок..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button className={s.clear} onClick={() => onChange('')}>✕</button>
      )}
      <button className={s.cancel} onClick={onClose}>Отмена</button>
    </div>
  );
}
