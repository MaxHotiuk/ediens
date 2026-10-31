import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean;
  prefixIcon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, prefixIcon, suffix, ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="relative flex items-center w-full">
        {prefixIcon && (
          <div className="absolute left-3 text-zinc-500 pointer-events-none flex items-center">
            {prefixIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full rounded-lg bg-zinc-950 border px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all duration-150',
            prefixIcon ? 'pl-9' : 'pl-3.5',
            suffix ? 'pr-12' : 'pr-3.5',
            hasError
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
              : 'border-zinc-800 hover:border-zinc-700 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400',
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 text-xs text-zinc-500 font-mono pointer-events-none flex items-center">
            {suffix}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export function FormField({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-col space-y-1.5 w-full', className)}>{children}</div>;
}

export function FormLabel({
  children,
  required,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-xs font-medium text-zinc-300 flex items-center gap-1 select-none', className)}
    >
      {children}
      {required && <span className="text-rose-400">*</span>}
    </label>
  );
}

export function FormError({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn('text-xs text-rose-400 font-mono flex items-center gap-1.5 pt-0.5 animate-fade-in', className)}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
