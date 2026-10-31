import { useState, useEffect, useCallback } from 'react';
import { InventoryItem, StorageLocation, CreateInventoryItemRequest } from '../../types/api';
import { ediensApi, DEFAULT_HOUSEHOLD_ID, EdiensApiError } from '../../api/client';
import { InventoryItemCard } from './InventoryItemCard';
import { AddInventoryModal } from './AddInventoryModal';
import { ConflictResolutionModal } from '../../components/ui/ConflictResolutionModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import {
  Plus,
  Search,
  Refrigerator,
  Archive,
  Snowflake,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export function InventoryDashboard({
  onShowToast,
}: {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 409 Conflict Modal State
  const [conflictItem, setConflictItem] = useState<{
    item: InventoryItem;
    serverQuantity: number;
    currentETag: string;
    attemptedQuantity: number;
    modifiedBy?: string;
  } | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const loc = selectedLocation === 'All' ? undefined : selectedLocation;
      const data = await ediensApi.inventory.getItems({
        householdId: DEFAULT_HOUSEHOLD_ID,
        location: loc,
      });
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Не вдалося завантажити інвентар із сервера';
      onShowToast('Помилка завантаження', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation, onShowToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Filtered by search
  const filteredItems = items.filter((item) =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary counts
  const totalCount = items.length;
  const criticalCount = items.filter((i) => i.freshnessStatus === 'CRITICAL' || i.freshnessStatus === 'EXPIRED').length;
  const warningCount = items.filter((i) => i.freshnessStatus === 'EXPIRING_SOON').length;
  const freshCount = items.filter((i) => i.freshnessStatus === 'FRESH').length;

  const handleConsume = async (item: InventoryItem, delta: number) => {
    try {
      const updated = await ediensApi.inventory.updateQuantity(
        item.id,
        { quantityDelta: delta, markOpened: false },
        item.etag
      );
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      onShowToast(
        'Продукт спожито',
        `Списано ${Math.abs(delta)} ${item.unit} з «${item.productName}». Новий залишок: ${updated.quantity} ${updated.unit}`,
        'success'
      );
    } catch (err: unknown) {
      if (err instanceof EdiensApiError && err.status === 409) {
        // Concurrency conflict! Extract RFC 9457 extensions
        const ext = err.problem?.extensions as Record<string, unknown> | undefined;
        const serverQty = typeof ext?.currentQuantity === 'number' ? ext.currentQuantity : item.quantity;
        const currentETag = typeof ext?.currentETag === 'string' ? ext.currentETag : item.etag;
        const modifiedBy = typeof ext?.lastModifiedBy === 'string' ? ext.lastModifiedBy : 'іншим учасником домогосподарства';

        setConflictItem({
          item,
          serverQuantity: serverQty,
          currentETag,
          attemptedQuantity: Math.max(0, item.quantity + delta),
          modifiedBy,
        });
        onShowToast(
          'Конфлікт 409 (OCC)',
          'Продукт було змінено паралельно. Будь ласка, оберіть дію в модальному вікні.',
          'warning'
        );
      } else {
        const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка оновлення кількості';
        onShowToast('Помилка списання', msg, 'error');
      }
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    try {
      await ediensApi.inventory.deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onShowToast('Партію видалено', `«${item.productName}» списано з інвентарю.`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка видалення партії';
      onShowToast('Помилка', msg, 'error');
    }
  };

  const handleSimulateConflict = async (item: InventoryItem) => {
    try {
      // Send an intentional outdated ETag to invoke real backend 409 Conflict validation
      await ediensApi.inventory.updateQuantity(
        item.id,
        { quantityDelta: -10, markOpened: false },
        'W/"stale_xmin_token_99999"'
      );
    } catch (err: unknown) {
      if (err instanceof EdiensApiError && err.status === 409) {
        const ext = err.problem?.extensions as Record<string, unknown> | undefined;
        const serverQty = typeof ext?.currentQuantity === 'number' ? ext.currentQuantity : item.quantity;
        const currentETag = typeof ext?.currentETag === 'string' ? ext.currentETag : item.etag;
        const modifiedBy = typeof ext?.lastModifiedBy === 'string' ? ext.lastModifiedBy : 'користувачем Anna';

        setConflictItem({
          item,
          serverQuantity: serverQty,
          currentETag,
          attemptedQuantity: Math.max(0, item.quantity - 10),
          modifiedBy,
        });
        onShowToast(
          '409 Conflict отримано',
          'Сервер повернув RFC 9457 CONCURRENT_MODIFICATION (ETag mismatch). Відкрито діалог розв\'язання конфлікту.',
          'warning'
        );
      } else {
        const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка тестування конфлікту';
        onShowToast('Помилка', msg, 'error');
      }
    }
  };

  const handleAddItem = async (data: CreateInventoryItemRequest) => {
    const newItem = await ediensApi.inventory.addItem(data);
    setItems((prev) => [...prev, newItem]);
    onShowToast('Партію додано', `«${data.productName}» успішно внесено до ${data.location}.`, 'success');
    await loadItems();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Refrigerator className="h-6 w-6 text-sky-400" />
            <span>Складські запаси та FEFO</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Облік партій продуктів (First Expired, First Out) з оптимістичним контролем версій (PostgreSQL xmin OCC).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => loadItems()}
            disabled={isLoading}
          >
            Оновити дані
          </Button>

          <Button
            variant="default"
            size="sm"
            icon={<Plus className="h-4 w-4 text-zinc-950" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Додати продукт
          </Button>
        </div>
      </div>

      {/* FEFO Metric Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 border-zinc-800/80 bg-zinc-950/60">
          <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Всього партій</div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-0.5">{totalCount}</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Всі локації</div>
        </Card>

        <Card className="p-3.5 border-rose-900/40 bg-rose-950/20">
          <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-400" />
            <span>Критичні (&lt;24 год)</span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300 mt-0.5">{criticalCount}</div>
          <div className="text-[10px] text-rose-400/70 font-mono mt-0.5">Потребують споживання</div>
        </Card>

        <Card className="p-3.5 border-amber-900/40 bg-amber-950/20">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Спливають (1–3 дні)</div>
          <div className="text-2xl font-bold font-mono text-amber-300 mt-0.5">{warningCount}</div>
          <div className="text-[10px] text-amber-400/70 font-mono mt-0.5">Рекомендовано для рецептів</div>
        </Card>

        <Card className="p-3.5 border-emerald-900/40 bg-emerald-950/20">
          <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Свіжі (&gt;3 днів)</div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-0.5">{freshCount}</div>
          <div className="text-[10px] text-emerald-400/70 font-mono mt-0.5">Безпечний запас</div>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'All', label: 'Всі локації', icon: null },
            { id: 'Fridge', label: 'Холодильник', icon: <Refrigerator className="h-3.5 w-3.5 text-sky-400" /> },
            { id: 'Freezer', label: 'Морозилка', icon: <Snowflake className="h-3.5 w-3.5 text-cyan-400" /> },
            { id: 'Pantry', label: 'Комора', icon: <Archive className="h-3.5 w-3.5 text-amber-400" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedLocation(tab.id as StorageLocation | 'All')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedLocation === tab.id
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <Input
            placeholder="Швидкий пошук за назвою..."
            prefixIcon={<Search className="h-3.5 w-3.5" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Notice on FEFO Sorting & OCC */}
      <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/40 border border-zinc-800/60 px-3.5 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-sky-400 shrink-0" />
          <span>
            Партії автоматично відсортовані за <strong>FEFO</strong> (першими відображаються продукти, строк придатності яких закінчується найближчим часом).
          </span>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-500">
          ETag: W/&quot;xmin&quot;
        </span>
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-zinc-400 text-sm gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
          <span>Завантаження актуальних запасів із бази даних...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="text-center p-8 border-dashed border-zinc-800">
          <CardContent className="space-y-3">
            <Refrigerator className="h-10 w-10 text-zinc-600 mx-auto" />
            <div className="text-sm font-medium text-zinc-300">Немає продуктів за обраними критеріями</div>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Спробуйте змінити пошуковий запит або додайте нову партію через кнопку «Додати продукт».
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Додати партію
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredItems.map((item) => (
            <InventoryItemCard
              key={item.id}
              item={item}
              onConsume={handleConsume}
              onDelete={handleDelete}
              onSimulateConflict={handleSimulateConflict}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AddInventoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddItem}
      />

      {/* 409 Conflict Resolution Modal */}
      {conflictItem && (
        <ConflictResolutionModal
          isOpen={Boolean(conflictItem)}
          onClose={() => setConflictItem(null)}
          itemName={conflictItem.item.productName}
          attemptedQuantity={conflictItem.attemptedQuantity}
          currentServerQuantity={conflictItem.serverQuantity}
          unit={conflictItem.item.unit}
          currentETag={conflictItem.currentETag}
          modifiedBy={conflictItem.modifiedBy || 'користувачем Anna'}
          onAcceptServer={() => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === conflictItem.item.id
                  ? { ...i, quantity: conflictItem.serverQuantity, etag: conflictItem.currentETag }
                  : i
              )
            );
            onShowToast(
              'Конфлікт 409 вирішено',
              `Прийнято актуальний залишок сервера: ${conflictItem.serverQuantity} ${conflictItem.item.unit}.`,
              'success'
            );
            setConflictItem(null);
          }}
          onReapplyWithServerQuantity={async (adjustedQty, newETag) => {
            try {
              const delta = adjustedQty - conflictItem.serverQuantity;
              const updated = await ediensApi.inventory.updateQuantity(
                conflictItem.item.id,
                { quantityDelta: delta, markOpened: false },
                newETag
              );
              setItems((prev) => prev.map((i) => (i.id === conflictItem.item.id ? updated : i)));
              onShowToast(
                'Зміни застосовано',
                `Залишок успішно збережено з новим If-Match (${adjustedQty} ${conflictItem.item.unit}).`,
                'success'
              );
              setConflictItem(null);
            } catch (err: unknown) {
              const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка повторного збереження';
              onShowToast('Помилка', msg, 'error');
            }
          }}
        />
      )}
    </div>
  );
}
