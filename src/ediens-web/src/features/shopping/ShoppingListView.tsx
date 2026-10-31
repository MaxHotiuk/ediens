import React, { useState, useEffect } from 'react';
import { ShoppingListItem, MeasurementUnit } from '../../types/api';
import { ediensStore } from '../store/mockStore';
import { ShoppingItemRow } from './ShoppingItemRow';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  ShoppingCart,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  CheckCheck,
} from 'lucide-react';

export interface ShoppingListViewProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function ShoppingListView({ onShowToast }: ShoppingListViewProps) {
  const [items, setItems] = useState<ShoppingListItem[]>(() => ediensStore.getShoppingList());
  const [isOffline, setIsOffline] = useState<boolean>(() => ediensStore.getOfflineMode());
  const [offlineChanges, setOfflineChanges] = useState<number>(() => ediensStore.getOfflineChangesCount());

  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnit, setNewUnit] = useState<MeasurementUnit>('pcs');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'purchased'>('all');

  const refresh = () => {
    setItems(ediensStore.getShoppingList());
    setIsOffline(ediensStore.getOfflineMode());
    setOfflineChanges(ediensStore.getOfflineChangesCount());
  };

  useEffect(() => {
    refresh();
    const unsub = ediensStore.subscribe(() => {
      refresh();
    });
    return unsub;
  }, []);

  const handleToggleOffline = () => {
    const next = !isOffline;
    ediensStore.setOfflineMode(next);
    setIsOffline(next);
    onShowToast(
      next ? 'Офлайн-режим увімкнено' : 'Підключення до мережі відновлено',
      next
        ? 'Усі відмітки та зміни зберігаються локально в LocalStorage.'
        : 'Ви можете синхронізувати локальні зміни з сервером.',
      next ? 'warning' : 'info'
    );
  };

  const handleSync = () => {
    const res = ediensStore.syncShoppingList();
    onShowToast(
      'Синхронізацію завершено',
      `Спільний список домогосподарства успішно оновлено (${res.syncedItemsCount} змін злито через POST /shopping-list/sync).`,
      'success'
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const qty = parseFloat(newQuantity) || 1;
    ediensStore.addShoppingItem(newName.trim(), qty, newUnit);

    onShowToast(
      'Товар додано',
      `«${newName.trim()}» (${qty} ${newUnit}) додано до списку покупок${isOffline ? ' [офлайн]' : ''}.`,
      'success'
    );

    setNewName('');
    setNewQuantity('1');
  };

  const handleToggle = (id: string) => {
    ediensStore.toggleShoppingItemPurchased(id);
    if (isOffline) {
      onShowToast(
        'Збережено офлайн',
        `Статус оновлено локально. Буде синхронізовано після повернення в мережу.`,
        'info'
      );
    }
  };

  const handleDelete = (id: string) => {
    ediensStore.deleteShoppingItem(id);
  };

  const handleClearPurchased = () => {
    ediensStore.clearPurchasedShoppingItems();
    onShowToast('Очищено', 'Всі придбані товари видалено зі списку.', 'info');
  };

  const filteredItems = items.filter((item) => {
    if (filterMode === 'pending') return !item.isPurchased;
    if (filterMode === 'purchased') return item.isPurchased;
    return true;
  });

  const pendingCount = items.filter((i) => !i.isPurchased).length;
  const purchasedCount = items.filter((i) => i.isPurchased).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShoppingCart className="h-6 w-6 text-sky-400" />
            <span>Спільний список покупок</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Офлайн-орієнтований спільний список для сім&apos;ї з локальним кешуванням та синхронізацією змін.
          </p>
        </div>

        {/* Network & Sync Status Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleOffline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              isOffline
                ? 'bg-amber-950/40 border-amber-700 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
            }`}
            title="Перемкнути симуляцію офлайн-режиму"
          >
            {isOffline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                <span>Офлайн (Супермаркет)</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span>В мережі (Online)</span>
              </>
            )}
          </button>

          <Button
            variant={offlineChanges > 0 ? 'default' : 'outline'}
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={handleSync}
            disabled={isOffline}
            className="text-xs"
          >
            {offlineChanges > 0
              ? `Синхронізувати (${offlineChanges})`
              : 'Синхронізовано'}
          </Button>
        </div>
      </div>

      {/* Offline Status Alert if offline */}
      {isOffline && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between gap-3 text-xs text-amber-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Режим офлайн активний:</strong> Ви можете відмічати товари та додавати нові без інтернет-з&apos;єднання.
              Зміни надійно зберігаються в пам&apos;яті браузера.
            </span>
          </div>
          <Badge variant="offline" dot>
            OFFLINE_FIRST
          </Badge>
        </div>
      )}

      {/* Quick Add Bar */}
      <Card className="border-zinc-800/80 bg-zinc-950/70">
        <CardContent className="p-4">
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1">
              <Input
                placeholder="Що потрібно купити? (наприклад: Вівсяне молоко, Яйця C0...)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="any"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-20 px-3 py-2 text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 outline-none focus:border-zinc-400"
              />

              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as MeasurementUnit)}
                className="w-20 rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
              >
                <option value="pcs">шт</option>
                <option value="g">г</option>
                <option value="ml">мл</option>
              </select>

              <Button
                variant="default"
                size="md"
                type="submit"
                icon={<Plus className="h-4 w-4 text-zinc-950" />}
                className="shrink-0"
              >
                Додати
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filter Tabs & Bulk Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Всі ({items.length})
          </button>
          <button
            onClick={() => setFilterMode('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === 'pending'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            До покупки ({pendingCount})
          </button>
          <button
            onClick={() => setFilterMode('purchased')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === 'purchased'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Куплені ({purchasedCount})
          </button>
        </div>

        {purchasedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5 text-zinc-400" />}
            onClick={handleClearPurchased}
            className="text-xs text-zinc-400 hover:text-rose-400"
          >
            Очистити куплені
          </Button>
        )}
      </div>

      {/* Shopping List Rows */}
      {filteredItems.length === 0 ? (
        <Card className="text-center p-8 border-dashed border-zinc-800">
          <CardContent className="space-y-2">
            <CheckCheck className="h-8 w-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-medium text-zinc-300">
              {filterMode === 'pending'
                ? 'Всі товари успішно куплені!'
                : 'Список покупок порожній'}
            </div>
            <p className="text-xs text-zinc-500">
              Додайте новий товар у формі вище або скористайтеся 1-Click Cook у вкладці «Рецепти».
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
