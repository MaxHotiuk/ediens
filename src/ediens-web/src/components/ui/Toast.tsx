import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle, Info, X, XCircle, Copy } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  traceId?: string;
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs || 5000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const copyTraceId = () => {
    if (toast.traceId) {
      navigator.clipboard.writeText(toast.traceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const icons = {
    info: <Info className="h-4 w-4 text-sky-400 shrink-0" />,
    success: <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />,
    error: <XCircle className="h-4 w-4 text-rose-400 shrink-0" />,
  };

  const borderVariants = {
    info: 'border-sky-800/60 bg-zinc-950/90',
    success: 'border-emerald-800/60 bg-zinc-950/90',
    warning: 'border-amber-800/60 bg-zinc-950/90',
    error: 'border-rose-800/70 bg-zinc-950/95',
  };

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-xl shadow-black/50 backdrop-blur-md max-w-sm w-full transition-all duration-200 animate-slide-down',
        borderVariants[toast.variant || 'info']
      )}
    >
      <div className="pt-0.5">{icons[toast.variant || 'info']}</div>

      <div className="flex-1 space-y-1">
        <div className="text-xs font-semibold text-zinc-100">{toast.title}</div>
        {toast.description && (
          <div className="text-xs text-zinc-400 leading-relaxed">
            {toast.description}
          </div>
        )}
        {toast.traceId && (
          <div className="pt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 font-mono">
              traceId: {toast.traceId.slice(0, 16)}...
            </span>
            <button
              onClick={copyTraceId}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded transition-colors"
            >
              <Copy className="h-2.5 w-2.5" />
              <span>{copied ? 'Скопійовано' : 'Копіювати'}</span>
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
        aria-label="Закрити сповіщення"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-auto">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
