import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingListItem, MeasurementUnit } from '../../types/api';
import { ediensApi, DEFAULT_HOUSEHOLD_ID, EdiensApiError, generateUuid } from '../../api/client';
import { ShoppingItemRow } from './ShoppingItemRow';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Trash2,
  CheckCheck,
  Database,
} from 'lucide-react';

export interface ShoppingListViewProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function ShoppingListView({ onShowToast }: ShoppingListViewProps) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnit, setNewUnit] = useState<MeasurementUnit>('pcs');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'purchased'>('all');

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const serverItems = await ediensApi.shoppingList.getItems(DEFAULT_HOUSEHOLD_ID);
      setItems(serverItems);
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Не вдалося завантажити список покупок із сервера';
      onShowToast('Помилка завантаження', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      await loadItems();
      onShowToast('Синхронізовано', 'Список покупок актуальний із базою даних PostgreSQL.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const qty = parseFloat(newQuantity) || 1;
    const nowIso = new Date().toISOString();
    const newItemId = generateUuid();

    const change = {
      id: newItemId,
      productName: newName.trim(),
      quantity: qty,
      unit: newUnit,
      isPurchased: false,
      clientUpdatedAt: nowIso,
    };

    setNewName('');
    setNewQuantity('1');

    try {
      const res = await ediensApi.shoppingList.sync(DEFAULT_HOUSEHOLD_ID, {
        clientChanges: [change],
      });
      setItems(res);
      onShowToast(
        'Товар додано',
        `«${change.productName}» (${qty} ${newUnit}) збережено у базі даних PostgreSQL.`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка збереження товару';
      onShowToast('Помилка додавання', msg, 'error');
      await loadItems();
    }
  };

  const handleToggle = async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const updatedStatus = !target.isPurchased;

    try {
      const res = await ediensApi.shoppingList.sync(DEFAULT_HOUSEHOLD_ID, {
        clientChanges: [
          {
            id: target.id,
            productName: target.productName,
            quantity: target.quantity,
            unit: target.unit,
            isPurchased: updatedStatus,
            clientUpdatedAt: nowIso,
          },
        ],
      });
      setItems(res);
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка оновлення статусу товару';
      onShowToast('Помилка', msg, 'error');
      await loadItems();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ediensApi.shoppingList.deleteItem(DEFAULT_HOUSEHOLD_ID, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onShowToast('Товар видалено', 'Позицію видалено з бази даних PostgreSQL.', 'info');
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка видалення';
      onShowToast('Помилка', msg, 'error');
      await loadItems();
    }
  };

  const handleClearPurchased = async () => {
    try {
      await ediensApi.shoppingList.clearPurchased(DEFAULT_HOUSEHOLD_ID);
      setItems((prev) => prev.filter((i) => !i.isPurchased));
      onShowToast('Очищено', 'Всі придбані товари видалено з бази даних PostgreSQL.', 'info');
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка очищення';
      onShowToast('Помилка', msg, 'error');
      await loadItems();
    }
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
            Спільний список для сім&apos;ї з надійним збереженням у PostgreSQL та синхронізацією змін.
          </p>
        </div>

        {/* Database & Sync Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="outline" className="flex items-center gap-1.5 text-xs text-emerald-400 border-emerald-800/60 bg-emerald-950/30">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span>PostgreSQL Synced</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            loading={isSyncing || isLoading}
            icon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading || isSyncing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={isSyncing || isLoading}
            className="text-xs"
          >
            Оновити
          </Button>
        </div>
      </div>

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
