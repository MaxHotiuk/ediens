import { ShoppingListItem } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Trash2, Check, User } from 'lucide-react';

export interface ShoppingItemRowProps {
  item: ShoppingListItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ShoppingItemRow({ item, onToggle, onDelete }: ShoppingItemRowProps) {
  return (
    <div
      className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
        item.isPurchased
          ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
          : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Custom Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
            item.isPurchased
              ? 'bg-emerald-500 border-emerald-400 text-zinc-950'
              : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-transparent'
          }`}
          aria-label={item.isPurchased ? 'Позначити як не куплене' : 'Позначити як куплене'}
        >
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </button>

        {/* Name & Details */}
        <div className="space-y-0.5">
          <span
            className={`text-sm font-medium transition-colors ${
              item.isPurchased ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {item.productName}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
            <span>
              {item.quantity} {item.unit}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {item.addedByUserId === 'user-anna-02' ? 'Анна' : 'Олег'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 p-1.5 h-7 w-7"
          onClick={() => onDelete(item.id)}
          title="Видалити зі списку покупок"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
