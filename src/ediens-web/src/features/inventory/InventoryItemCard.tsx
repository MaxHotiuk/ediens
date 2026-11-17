import { useState } from 'react';
import { InventoryItem } from '../../types/api';
import { FreshnessBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Minus, Trash2, GitFork, Check, Refrigerator, Archive, Snowflake, Pencil, AlertOctagon } from 'lucide-react';

export interface InventoryItemCardProps {
  item: InventoryItem;
  onConsume: (item: InventoryItem, delta: number) => void;
  onDelete: (item: InventoryItem, reason?: string) => void;
  onEdit?: (item: InventoryItem) => void;
  onSpoil?: (item: InventoryItem) => void;
  onSimulateConflict?: (item: InventoryItem) => void;
  showDebugActions?: boolean;
}

export function InventoryItemCard({
  item,
  onConsume,
  onDelete,
  onEdit,
  onSpoil,
  onSimulateConflict,
  showDebugActions = false,
}: InventoryItemCardProps) {
  const [isConsuming, setIsConsuming] = useState(false);
  const [customDelta, setCustomDelta] = useState<number>(() => {
    if (item.unit === 'pcs') return 1;
    if (item.unit === 'ml') return 200;
    return 100;
  });

  const getLocationIcon = () => {
    switch (item.location) {
      case 'Fridge':
        return <Refrigerator className="h-3.5 w-3.5 text-sky-400" />;
      case 'Freezer':
        return <Snowflake className="h-3.5 w-3.5 text-cyan-400" />;
      case 'Pantry':
        return <Archive className="h-3.5 w-3.5 text-amber-400" />;
    }
  };

  const getLocationLabel = () => {
    switch (item.location) {
      case 'Fridge':
        return 'Холодильник';
      case 'Freezer':
        return 'Морозилка';
      case 'Pantry':
        return 'Комора';
    }
  };

  const handleQuickDeduct = () => {
    onConsume(item, -customDelta);
    setIsConsuming(false);
  };

  const handleSpoilClick = () => {
    if (onSpoil) {
      onSpoil(item);
    } else {
      onDelete(item, 'SPOILED');
    }
  };

  return (
    <div className="group relative rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/40 hover:shadow-lg hover:shadow-black/40">
      {/* Top row: Location & Freshness Badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-2 py-0.5 rounded-md">
          {getLocationIcon()}
          <span>{getLocationLabel()}</span>
        </div>
        <FreshnessBadge status={item.freshnessStatus} days={item.daysUntilExpiration} />
      </div>

      {/* Middle row: Name & Quantity */}
      <div className="space-y-1 mb-3">
        <h3 className="font-semibold text-zinc-100 text-sm tracking-tight line-clamp-1 group-hover:text-white">
          {item.productName}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-zinc-200">
            {item.quantity}
          </span>
          <span className="text-xs font-mono text-zinc-500">{item.unit}</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/80">
            ETag: {item.etag}
          </span>
        </div>
      </div>

      {/* Expiration date details */}
      <div className="text-[11px] text-zinc-500 font-mono mb-3 flex items-center justify-between">
        <span>Придатний до:</span>
        <span className="text-zinc-400">
          {new Date(item.expiresAt).toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Inline consume drawer / actions */}
      {isConsuming ? (
        <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2 animate-fade-in">
          <div className="text-[11px] text-zinc-400 font-medium">Списати кількість:</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max={item.quantity}
              value={customDelta}
              onChange={(e) => setCustomDelta(Math.max(1, parseFloat(e.target.value) || 1))}
              className="w-20 px-2 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 rounded text-zinc-100"
            />
            <span className="text-xs text-zinc-500 font-mono">{item.unit}</span>
            <Button
              variant="default"
              size="sm"
              icon={<Check className="h-3 w-3" />}
              className="ml-auto text-xs py-1 px-2.5 h-7"
              onClick={handleQuickDeduct}
            >
              Списати
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs py-1 px-2 h-7"
              onClick={() => setIsConsuming(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-zinc-900 gap-1.5">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              icon={<Minus className="h-3 w-3" />}
              className="text-xs py-1 px-2 h-7"
              onClick={() => setIsConsuming(true)}
              title="Спожити частину продукту"
            >
              Спожити
            </Button>

            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="h-3 w-3 text-zinc-400" />}
                className="text-xs py-1 px-2 h-7 text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                onClick={() => onEdit(item)}
                title="Редагувати партію (локація, дата, кількість)"
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Quick action: Списати як зіпсоване */}
            <Button
              variant="ghost"
              size="sm"
              icon={<AlertOctagon className="h-3 w-3 text-rose-400" />}
              className="text-xs py-1 px-2 h-7 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
              onClick={handleSpoilClick}
              title="Списати як зіпсоване (DELETE з Outbox подією)"
            >
              Зіпсовано
            </Button>

            {/* Optional debug test action */}
            {showDebugActions && onSimulateConflict && (
              <Button
                variant="ghost"
                size="sm"
                icon={<GitFork className="h-3 w-3 text-amber-400" />}
                className="text-xs py-1 px-2 h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-950/30"
                onClick={() => onSimulateConflict(item)}
                title="Змоделювати 409 Conflict (ETag xmin)"
              >
                409
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-3 w-3 text-zinc-500 group-hover:text-rose-400" />}
              className="text-xs py-1 px-2 h-7 hover:bg-rose-950/30 hover:text-rose-400"
              onClick={() => onDelete(item)}
              title="Видалити партію"
            />
          </div>
        </div>
      )}
    </div>
  );
}
