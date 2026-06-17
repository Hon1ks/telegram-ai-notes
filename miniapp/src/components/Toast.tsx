import { useEffect } from 'react';
import s from './Toast.module.css';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastState {
  message: string;
  action?: ToastAction;
  duration?: number;
}

interface Props {
  toast: ToastState | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, toast.duration ?? 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className={s.toast} role="alert">
      <span className={s.message}>{toast.message}</span>
      <div className={s.actions}>
        {toast.action && (
          <button
            type="button"
            className={s.action}
            onClick={() => { toast.action!.onClick(); onClose(); }}
          >
            {toast.action.label}
          </button>
        )}
        <button type="button" className={s.close} onClick={onClose} aria-label="Закрыть">✕</button>
      </div>
    </div>
  );
}