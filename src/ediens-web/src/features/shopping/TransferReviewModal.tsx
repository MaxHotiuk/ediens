import React, { useState, useEffect } from 'react';
import { ShoppingListItem, StorageLocation } from '../../types/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PackageCheck, Snowflake, Refrigerator, Archive } from 'lucide-react';

export interface TransferItemConfig {
  itemId: string;
  productName: string;
  quantity: number;
  unit: string;
  location: StorageLocation;
  expiresAt: string;
  shelfLifeDays: number;
}

export function getSmartStorageDefaults(productName: string): {
  location: StorageLocation;
  shelfLifeDays: number;
  expiryDateStr: string;
  categoryLabel: string;
} {
  const name = (productName || '').toLowerCase();

  let location: StorageLocation = 'Fridge';
  let shelfLifeDays = 4;
  let categoryLabel = 'М\'ясо / молочка';

  // 1. Frozen -> Freezer +180 days
  if (
    name.includes('заморож') ||
    name.includes('frozen') ||
    name.includes('freezer') ||
    name.includes('морозив') ||
    name.includes('пельмен') ||
    name.includes('вареник') ||
    name.includes('лід') ||
    name.includes('напівфабрикат')
  ) {
    location = 'Freezer';
    shelfLifeDays = 180;
    categoryLabel = 'Заморозка (+180 дн)';
  }
  // 2. Meat, poultry, fish, seafood -> Fridge +4 days
  else if (
    name.includes("м'яс") ||
    name.includes('мяс') ||
    name.includes('куряч') ||
    name.includes('курк') ||
    name.includes('філе') ||
    name.includes('свинин') ||
    name.includes('яловичин') ||
    name.includes('фарш') ||
    name.includes('стейк') ||
    name.includes('ковбас') ||
    name.includes('сосиск') ||
    name.includes('шинк') ||
    name.includes('риба') ||
    name.includes('рибн') ||
    name.includes('лосось') ||
    name.includes('тунець') ||
    name.includes('хек') ||
    name.includes('креветк') ||
    name.includes('бекон') ||
    name.includes('meat') ||
    name.includes('chicken') ||
    name.includes('beef') ||
    name.includes('pork') ||
    name.includes('fish') ||
    name.includes('salmon') ||
    name.includes('tuna') ||
    name.includes('steak') ||
    name.includes('bacon')
  ) {
    location = 'Fridge';
    shelfLifeDays = 4;
    categoryLabel = 'М\'ясо / риба (+4 дн)';
  }
  // 3. Dairy, eggs -> Fridge +4 days
  else if (
    name.includes('молок') ||
    name.includes('сир') ||
    name.includes('творог') ||
    name.includes('кефір') ||
    name.includes('йогурт') ||
    name.includes('сметан') ||
    name.includes('масло') ||
    name.includes('вершк') ||
    name.includes('ряжанк') ||
    name.includes('яйц') ||
    name.includes('milk') ||
    name.includes('cheese') ||
    name.includes('yogurt') ||
    name.includes('butter') ||
    name.includes('cream') ||
    name.includes('dairy') ||
    name.includes('egg')
  ) {
    location = 'Fridge';
    shelfLifeDays = 4;
    categoryLabel = 'Молочні / яйця (+4 дн)';
  }
  // 4. Fresh fruits and vegetables -> Fridge +7 days
  else if (
    name.includes('яблук') ||
    name.includes('банан') ||
    name.includes('огірок') ||
    name.includes('помідор') ||
    name.includes('томат') ||
    name.includes('салат') ||
    name.includes('зелень') ||
    name.includes('шпинат') ||
    name.includes('моркв') ||
    name.includes('капуст') ||
    name.includes('апельсин') ||
    name.includes('лимон') ||
    name.includes('ягід') ||
    name.includes('полуниц') ||
    name.includes('чорниц') ||
    name.includes('авокадо') ||
    name.includes('fruit') ||
    name.includes('vegetable') ||
    name.includes('tomato') ||
    name.includes('cucumber') ||
    name.includes('apple') ||
    name.includes('banana') ||
    name.includes('berry') ||
    name.includes('salad') ||
    name.includes('greens') ||
    name.includes('spinach')
  ) {
    location = 'Fridge';
    shelfLifeDays = 7;
    categoryLabel = 'Овочі / фрукти (+7 дн)';
  }
  // 5. Grains, Canned, Pasta, Bread, Oil, Dry goods -> Pantry +90 days
  else if (
    name.includes('круп') ||
    name.includes('рис') ||
    name.includes('гречк') ||
    name.includes('вівсян') ||
    name.includes('борошн') ||
    name.includes('макарон') ||
    name.includes('паста') ||
    name.includes('спагет') ||
    name.includes('консерв') ||
    name.includes('тушонк') ||
    name.includes('горох') ||
    name.includes('квасол') ||
    name.includes('кукурудз') ||
    name.includes('олія') ||
    name.includes('цукор') ||
    name.includes('сіль') ||
    name.includes('перець') ||
    name.includes('спеці') ||
    name.includes('хліб') ||
    name.includes('батон') ||
    name.includes('печив') ||
    name.includes('чай') ||
    name.includes('кава') ||
    name.includes('соус') ||
    name.includes('кетчуп') ||
    name.includes('майонез') ||
    name.includes('шоколад') ||
    name.includes('горіх') ||
    name.includes('цибул') ||
    name.includes('часник') ||
    name.includes('картоп') ||
    name.includes('grain') ||
    name.includes('rice') ||
    name.includes('pasta') ||
    name.includes('canned') ||
    name.includes('flour') ||
    name.includes('oil') ||
    name.includes('sugar') ||
    name.includes('bread') ||
    name.includes('coffee') ||
    name.includes('tea') ||
    name.includes('oats') ||
    name.includes('cereal') ||
    name.includes('nuts') ||
    name.includes('beans')
  ) {
    location = 'Pantry';
    shelfLifeDays = 90;
    categoryLabel = 'Бакалія / консерви (+90 дн)';
  }

  const d = new Date();
  d.setDate(d.getDate() + shelfLifeDays);
  const expiryDateStr = d.toISOString().split('T')[0];

  return { location, shelfLifeDays, expiryDateStr, categoryLabel };
}

export interface TransferReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingListItem[];
  onConfirm: (
    itemsToTransfer: Array<{
      itemId: string;
      location: StorageLocation;
      expiresAt: string;
      quantity: number;
      unit: string;
    }>
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export function TransferReviewModal({
  isOpen,
  onClose,
  items,
  onConfirm,
  isSubmitting = false,
}: TransferReviewModalProps) {
  const [configs, setConfigs] = useState<TransferItemConfig[]>([]);

  useEffect(() => {
    if (isOpen) {
      const initialConfigs: TransferItemConfig[] = items.map((item) => {
        const smart = getSmartStorageDefaults(item.productName);
        return {
          itemId: item.id,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          location: smart.location,
          expiresAt: smart.expiryDateStr,
          shelfLifeDays: smart.shelfLifeDays,
        };
      });
      setConfigs(initialConfigs);
    }
  }, [isOpen, items]);

  const handleLocationChange = (itemId: string, newLocation: StorageLocation) => {
    setConfigs((prev) =>
      prev.map((cfg) => {
        if (cfg.itemId !== itemId) return cfg;
        // If changed to freezer, suggest 180 days; if pantry, 90; if fridge, 4
        let days = cfg.shelfLifeDays;
        if (newLocation === 'Freezer' && cfg.location !== 'Freezer') days = 180;
        else if (newLocation === 'Pantry' && cfg.location !== 'Pantry') days = 90;
        else if (newLocation === 'Fridge' && cfg.location !== 'Fridge') days = 4;

        const d = new Date();
        d.setDate(d.getDate() + days);
        const expiresAt = d.toISOString().split('T')[0];

        return {
          ...cfg,
          location: newLocation,
          shelfLifeDays: days,
          expiresAt,
        };
      })
    );
  };

  const handleExpiryChange = (itemId: string, newExpiry: string) => {
    setConfigs((prev) =>
      prev.map((cfg) => (cfg.itemId === itemId ? { ...cfg, expiresAt: newExpiry } : cfg))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = configs.map((c) => ({
      itemId: c.itemId,
      location: c.location,
      expiresAt: new Date(c.expiresAt).toISOString(),
      quantity: c.quantity,
      unit: c.unit,
    }));
    await onConfirm(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-emerald-400" />
          <span>Перенести куплені товари в інвентар</span>
        </div>
      }
      description="Перевірте або змініть зону зберігання та строк придатності. Системою автоматично підібрано оптимальні параметри."
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Скасувати
          </Button>
          <Button
            variant="default"
            size="sm"
            loading={isSubmitting}
            onClick={handleSubmit}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs"
          >
            Підтвердити перенесення ({configs.length})
          </Button>
        </div>
      }
    >
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {configs.map((cfg) => {
          const smartInfo = getSmartStorageDefaults(cfg.productName);

          return (
            <div
              key={cfg.itemId}
              className="p-3.5 rounded-xl border border-zinc-800/90 bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
            >
              <div className="space-y-1 min-w-[180px]">
                <div className="font-medium text-zinc-100 text-sm flex items-center gap-1.5">
                  <span>{cfg.productName}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                  <span>
                    {cfg.quantity} {cfg.unit}
                  </span>
                  <span>•</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-zinc-700 text-zinc-400">
                    {smartInfo.categoryLabel}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Location Select */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-zinc-500 mr-1">Зона:</span>
                  <div className="relative">
                    <select
                      value={cfg.location}
                      onChange={(e) => handleLocationChange(cfg.itemId, e.target.value as StorageLocation)}
                      className="rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500 flex items-center"
                    >
                      <option value="Fridge">Холодильник</option>
                      <option value="Freezer">Морозилка</option>
                      <option value="Pantry">Комора</option>
                    </select>
                  </div>
                  {cfg.location === 'Fridge' && <Refrigerator className="h-3.5 w-3.5 text-sky-400 ml-1" />}
                  {cfg.location === 'Freezer' && <Snowflake className="h-3.5 w-3.5 text-cyan-400 ml-1" />}
                  {cfg.location === 'Pantry' && <Archive className="h-3.5 w-3.5 text-amber-400 ml-1" />}
                </div>

                {/* Expiry Date */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-zinc-500 mr-1">Придатний до:</span>
                  <input
                    type="date"
                    value={cfg.expiresAt}
                    onChange={(e) => handleExpiryChange(cfg.itemId, e.target.value)}
                    className="rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs text-zinc-200 font-mono outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
