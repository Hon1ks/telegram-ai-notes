import { useEffect } from 'react';
import s from './Toast.module.css';

interface Props {
  message: string | null;
  onClose: () => void;
}

export function Toast({ message, onClose }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={s.toast} role="alert">
      <span>{message}</span>
      <button className={s.close} onClick={onClose} aria-label="Закрыть">✕</button>
    </div>
  );
}