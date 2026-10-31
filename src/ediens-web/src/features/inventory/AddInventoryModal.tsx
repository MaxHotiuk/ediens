import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, FormField, FormLabel, FormError } from '../../components/ui/Input';
import { StorageLocation, MeasurementUnit } from '../../types/api';
import { Plus, Refrigerator, Archive, Snowflake, Sparkles } from 'lucide-react';

export interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: {
    productName: string;
    location: StorageLocation;
    quantity: number;
    unit: MeasurementUnit;
    expiresAt: string;
    householdId: string;
  }) => void;
}

const PRESET_PRODUCTS = [
  { name: "Молоко фермерське 2.5%", location: 'Fridge' as StorageLocation, unit: 'ml' as MeasurementUnit, defaultDays: 4, defaultQty: 900 },
  { name: "Яйця курячі C0", location: 'Fridge' as StorageLocation, unit: 'pcs' as MeasurementUnit, defaultDays: 14, defaultQty: 10 },
  { name: "Куряче філе охолоджене", location: 'Fridge' as StorageLocation, unit: 'g' as MeasurementUnit, defaultDays: 2, defaultQty: 600 },
  { name: "Сир кисломолочний 5%", location: 'Fridge' as StorageLocation, unit: 'g' as MeasurementUnit, defaultDays: 3, defaultQty: 350 },
  { name: "Лосось слабосолений", location: 'Fridge' as StorageLocation, unit: 'g' as MeasurementUnit, defaultDays: 5, defaultQty: 200 },
  { name: "Заморожені ягоди лохини", location: 'Freezer' as StorageLocation, unit: 'g' as MeasurementUnit, defaultDays: 90, defaultQty: 400 },
  { name: "Гречана крупа ядриця", location: 'Pantry' as StorageLocation, unit: 'g' as MeasurementUnit, defaultDays: 120, defaultQty: 1000 },
];

export function AddInventoryModal({ isOpen, onClose, onAdd }: AddInventoryModalProps) {
  const [productName, setProductName] = useState('');
  const [location, setLocation] = useState<StorageLocation>('Fridge');
  const [quantity, setQuantity] = useState<string>('500');
  const [unit, setUnit] = useState<MeasurementUnit>('g');
  const [expiryDays, setExpiryDays] = useState<number>(3);
  const [errorName, setErrorName] = useState<string | null>(null);
  const [errorQuantity, setErrorQuantity] = useState<string | null>(null);

  const applyPreset = (preset: typeof PRESET_PRODUCTS[0]) => {
    setProductName(preset.name);
    setLocation(preset.location);
    setUnit(preset.unit);
    setExpiryDays(preset.defaultDays);
    setQuantity(String(preset.defaultQty));
    setErrorName(null);
    setErrorQuantity(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!productName.trim()) {
      setErrorName('Вкажіть назву продукту');
      hasError = true;
    } else {
      setErrorName(null);
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorQuantity('Кількість має бути більшою за 0 (VALIDATION_FAILED)');
      hasError = true;
    } else {
      setErrorQuantity(null);
    }

    if (hasError) return;

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    onAdd({
      householdId: 'hh-podil-01',
      productName: productName.trim(),
      location,
      quantity: qty,
      unit,
      expiresAt,
    });

    // Reset form
    setProductName('');
    setQuantity('500');
    setExpiryDays(3);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-emerald-400" />
          <span>Додати партію в інвентар (FEFO)</span>
        </div>
      }
      description="Внесіть партію продуктів з терміном придатності для автоматичного обліку FEFO."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Quick Presets */}
        <div>
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Швидкі шаблони продуктів:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PRODUCTS.slice(0, 4).map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              >
                {p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}
              </button>
            ))}
          </div>
        </div>

        {/* Product Name */}
        <FormField>
          <FormLabel htmlFor="product-name" required>
            Назва продукту:
          </FormLabel>
          <Input
            id="product-name"
            placeholder="Наприклад: Куряче філе або Молоко 2.5%"
            value={productName}
            onChange={(e) => {
              setProductName(e.target.value);
              if (errorName) setErrorName(null);
            }}
            error={Boolean(errorName)}
          />
          <FormError message={errorName} />
        </FormField>

        {/* Storage Location Selector */}
        <FormField>
          <FormLabel>Локація зберігання:</FormLabel>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setLocation('Fridge')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                location === 'Fridge'
                  ? 'bg-sky-950/40 border-sky-600/80 text-sky-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <Refrigerator className="h-4 w-4 text-sky-400" />
              <span>Холодильник</span>
            </button>
            <button
              type="button"
              onClick={() => setLocation('Freezer')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                location === 'Freezer'
                  ? 'bg-cyan-950/40 border-cyan-600/80 text-cyan-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <Snowflake className="h-4 w-4 text-cyan-400" />
              <span>Морозилка</span>
            </button>
            <button
              type="button"
              onClick={() => setLocation('Pantry')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                location === 'Pantry'
                  ? 'bg-amber-950/40 border-amber-600/80 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <Archive className="h-4 w-4 text-amber-400" />
              <span>Комора</span>
            </button>
          </div>
        </FormField>

        {/* Quantity & Unit */}
        <div className="grid grid-cols-2 gap-3">
          <FormField>
            <FormLabel htmlFor="quantity" required>
              Кількість:
            </FormLabel>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0.1"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (errorQuantity) setErrorQuantity(null);
              }}
              error={Boolean(errorQuantity)}
            />
            <FormError message={errorQuantity} />
          </FormField>

          <FormField>
            <FormLabel htmlFor="unit">Одиниця виміру:</FormLabel>
            <select
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
            >
              <option value="g">грами (г)</option>
              <option value="ml">мілілітри (мл)</option>
              <option value="pcs">штуки (шт)</option>
            </select>
          </FormField>
        </div>

        {/* Expiration date presets */}
        <FormField>
          <FormLabel>Термін придатності (FEFO):</FormLabel>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: '+1 день (< 24г)', days: 1 },
              { label: '+3 дні', days: 3 },
              { label: '+7 днів', days: 7 },
              { label: '+14 днів', days: 14 },
              { label: '+30 днів', days: 30 },
            ].map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setExpiryDays(p.days)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                  expiryDays === p.days
                    ? 'bg-zinc-100 text-zinc-950 font-semibold border-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono pt-1">
            Розрахункова дата спливу:{' '}
            <span className="text-zinc-300">
              {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString('uk-UA', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              })}
            </span>
          </div>
        </FormField>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-900">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Скасувати
          </Button>
          <Button variant="default" size="sm" type="submit" icon={<Plus className="h-4 w-4" />}>
            Додати в інвентар
          </Button>
        </div>
      </form>
    </Modal>
  );
}
