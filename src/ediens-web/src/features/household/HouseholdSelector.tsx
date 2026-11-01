import { useState, useEffect, useRef, useCallback } from 'react';
import { ediensApi, HouseholdSummary, EdiensApiError } from '../../api/client';
import { Home, Users, ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface HouseholdSelectorProps {
  activeHouseholdId: string;
  onSelectHousehold: (household: HouseholdSummary) => void;
  onOpenManageModal: () => void;
  onShowToast?: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
  className?: string;
  refreshTrigger?: number;
}

export function HouseholdSelector({
  activeHouseholdId,
  onSelectHousehold,
  onOpenManageModal,
  onShowToast,
  className,
  refreshTrigger = 0,
}: HouseholdSelectorProps) {
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchHouseholds = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ediensApi.households.getHouseholds();
      setHouseholds(data);

      // Якщо активне домогосподарство ще не вибрано або його немає в списку, вибираємо перше
      if (data.length > 0) {
        const current = data.find((h) => h.id === activeHouseholdId);
        if (!current && data[0]) {
          onSelectHousehold(data[0]);
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof EdiensApiError
          ? err.problem?.detail || err.message
          : 'Не вдалося завантажити перелік домогосподарств';
      onShowToast?.('Помилка домогосподарств', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeHouseholdId, onSelectHousehold, onShowToast]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds, refreshTrigger]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeHousehold = households.find((h) => h.id === activeHouseholdId) || households[0];

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Trigger Button in Navbar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-sky-500/50 shadow-sm select-none',
          isOpen && 'border-sky-500/60 ring-1 ring-sky-500/40 bg-zinc-800'
        )}
        title="Перемкнути домогосподарство або керувати учасниками"
      >
        <Home className="h-3.5 w-3.5 text-sky-400 shrink-0" />
        <span className="font-medium text-white max-w-[150px] sm:max-w-[200px] truncate">
          {isLoading ? 'Завантаження...' : activeHousehold ? activeHousehold.name : 'Домогосподарство'}
        </span>

        {activeHousehold && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-mono border',
                activeHousehold.role === 'Owner'
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
              )}
            >
              {activeHousehold.role}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] text-zinc-400 font-mono">
              <Users className="h-3 w-3 text-zinc-500" />
              <span>{activeHousehold.membersCount}</span>
            </span>
          </div>
        )}

        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-zinc-400 transition-transform duration-150 shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/80 z-50 p-2 animate-fade-in text-xs">
          <div className="px-2.5 py-2 border-b border-zinc-900 flex items-center justify-between text-zinc-400">
            <span className="font-semibold text-zinc-200">Ваші домогосподарства</span>
            <span className="text-[10px] font-mono text-zinc-500">
              {households.length} {households.length === 1 ? 'сімʼя' : 'сімей'}
            </span>
          </div>

          {/* List of households */}
          <div className="py-1 space-y-1 max-h-60 overflow-y-auto">
            {households.map((h) => {
              const isSelected = h.id === activeHousehold?.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    onSelectHousehold(h);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors group',
                    isSelected
                      ? 'bg-zinc-900 border border-zinc-700/70 text-white'
                      : 'hover:bg-zinc-900/60 text-zinc-300 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <div
                      className={cn(
                        'h-6 w-6 rounded-md flex items-center justify-center shrink-0 border',
                        isSelected
                          ? 'bg-sky-950/60 border-sky-800 text-sky-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                      )}
                    >
                      <Home className="h-3.5 w-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-medium truncate text-zinc-100">{h.name}</div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                        <span className="font-mono">{h.role}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />
                          {h.membersCount} {h.membersCount === 1 ? 'учасник' : 'учасники'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isSelected && <Check className="h-4 w-4 text-sky-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 mt-1 border-t border-zinc-900 space-y-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenManageModal();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 text-left transition-colors font-medium"
            >
              <Settings className="h-3.5 w-3.5 text-sky-400" />
              <span>Керування сім&apos;єю та учасники</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenManageModal();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 text-left transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>Приєднатися за кодом запрошення</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
