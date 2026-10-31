import React, { useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  closeOnBackdropClick?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  className,
  closeOnBackdropClick = true,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/80 z-10 transition-all animate-fade-in',
          maxWidthStyles[maxWidth],
          className
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-400"
          aria-label="Закрити"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        {(title || description) && (
          <div className="mb-4 pr-6">
            {title && (
              <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="text-sm text-zinc-200">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
