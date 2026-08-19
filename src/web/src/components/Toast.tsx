import React from 'react';
import { Icons } from './Icons';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item ${t.type}`} onClick={() => onDismiss(t.id)}>
          <div className="toast-icon">
            {t.type === 'success' && <Icons.CheckCircle size={18} color="var(--accent-emerald)" />}
            {t.type === 'error' && <Icons.XCircle size={18} color="var(--accent-rose)" />}
            {t.type === 'warning' && <Icons.AlertTriangle size={18} color="var(--accent-amber)" />}
            {t.type === 'info' && <Icons.Info size={18} color="var(--primary)" />}
          </div>
          <div className="toast-content">
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
