import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Clock, ShieldAlert } from 'lucide-react';

export interface RateLimitBannerProps {
  retryAfterSeconds: number;
  onTimerExpired?: () => void;
  message?: string;
  className?: string;
  isSticky?: boolean;
}

export function RateLimitBanner({
  retryAfterSeconds,
  onTimerExpired,
  message = 'Перевищено ліміт запитів (429 Rate Limit Exceeded).',
  className,
  isSticky = true,
}: RateLimitBannerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(retryAfterSeconds);
  const [initialSeconds] = useState<number>(retryAfterSeconds || 30);

  useEffect(() => {
    setTimeLeft(retryAfterSeconds);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimerExpired?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimerExpired?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimerExpired]);

  if (timeLeft <= 0) {
    return null;
  }

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / (initialSeconds || 1)) * 100));

  return (
    <div
      role="alert"
      className={cn(
        'w-full bg-amber-950/90 border-b border-amber-800/80 text-amber-200 px-4 py-3 backdrop-blur-md z-40 transition-all duration-200 shadow-lg shadow-black/30',
        isSticky && 'sticky top-0',
        className
      )}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-semibold text-amber-300">{message}</span>
            <span className="text-amber-200/80 ml-1.5 hidden sm:inline">
              Будь ласка, зачекайте завершення кулдауну перед наступною спробою.
            </span>
          </div>
        </div>

        {/* Countdown Badge & Timer */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/60 border border-amber-700/60 font-mono text-xs font-semibold text-amber-300">
            <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Зачекайте {timeLeft} с</span>
          </div>
        </div>
      </div>

      {/* Dynamic Linear Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-950">
        <div
          className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
