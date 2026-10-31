import { useState, useEffect } from 'react';
import { InventoryItem, StorageLocation } from '../../types/api';
import { ediensStore } from '../store/mockStore';
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
  RotateCcw,
} from 'lucide-react';

export function InventoryDashboard({
  onShowToast,
}: {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 409 Conflict Modal State
  const [conflictItem, setConflictItem] = useState<{
    item: InventoryItem;
    serverQuantity: number;
    currentETag: string;
    attemptedQuantity: number;
  } | null>(null);

  const loadItems = () => {
    const loc = selectedLocation === 'All' ? undefined : selectedLocation;
    const all = ediensStore.getInventoryItems(loc);
    setItems(all);
  };

  useEffect(() => {
    loadItems();
    const unsub = ediensStore.subscribe(() => {
      loadItems();
    });
    return unsub;
  }, [selectedLocation]);

  // Filtered by search
  const filteredItems = items.filter((item) =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary counts
  const totalCount = items.length;
  const criticalCount = items.filter((i) => i.freshnessStatus === 'CRITICAL' || i.freshnessStatus === 'EXPIRED').length;
  const warningCount = items.filter((i) => i.freshnessStatus === 'EXPIRING_SOON').length;
  const freshCount = items.filter((i) => i.freshnessStatus === 'FRESH').length;

  const handleConsume = (item: InventoryItem, delta: number) => {
    const result = ediensStore.updateInventoryQuantity(item.id, delta, item.etag);
    if (result.conflict) {
      setConflictItem({
        item,
        serverQuantity: item.quantity,
        currentETag: item.etag,
        attemptedQuantity: Math.max(0, item.quantity + delta),
      });
    } else {
      onShowToast(
        'Продукт спожито',
        `Списано ${Math.abs(delta)} ${item.unit} з «${item.productName}». Новий залишок: ${
          Math.max(0, item.quantity + delta)
        } ${item.unit}`,
        'success'
      );
    }
  };

  const handleDelete = (item: InventoryItem) => {
    ediensStore.deleteInventoryItem(item.id);
    onShowToast('Партію видалено', `«${item.productName}» списано з інвентарю.`, 'info');
  };

  const handleSimulateConflict = (item: InventoryItem) => {
    ediensStore.simulateExternalConflict(item.id);
    setConflictItem({
      item,
      serverQuantity: Math.max(50, Math.round(item.quantity * 0.6)),
      currentETag: `W/"${Math.floor(50000 + Math.random() * 40000)}"`,
      attemptedQuantity: item.quantity,
    });
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
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => {
              ediensStore.resetAllToSeed();
              onShowToast('Дані скинуто', 'Складські залишки повернуто до початкових seed-даних.', 'info');
            }}
          >
            Скинути дані
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

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
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
        onAdd={(data) => {
          ediensStore.addInventoryItem(data);
          onShowToast('Партію додано', `«${data.productName}» успішно внесено до ${data.location}.`, 'success');
        }}
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
          modifiedBy="користувачем Anna"
          onAcceptServer={() => {
            onShowToast(
              'Конфлікт 409 вирішено',
              `Прийнято актуальний залишок сервера: ${conflictItem.serverQuantity} ${conflictItem.item.unit}.`,
              'success'
            );
            setConflictItem(null);
          }}
          onReapplyWithServerQuantity={(adjustedQty, newETag) => {
            ediensStore.updateInventoryQuantity(
              conflictItem.item.id,
              adjustedQty - conflictItem.serverQuantity,
              newETag
            );
            onShowToast(
              'Зміни застосовано',
              `Залишок успішно збережено з новим If-Match (${adjustedQty} ${conflictItem.item.unit}).`,
              'success'
            );
            setConflictItem(null);
          }}
        />
      )}
    </div>
  );
}
