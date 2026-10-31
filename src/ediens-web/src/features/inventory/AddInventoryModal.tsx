import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, FormField, FormLabel, FormError } from '../../components/ui/Input';
import { StorageLocation, MeasurementUnit, CreateInventoryItemRequest } from '../../types/api';
import { ediensApi, DEFAULT_HOUSEHOLD_ID, EdiensApiError } from '../../api/client';
import { Plus, Refrigerator, Archive, Snowflake, Sparkles, ScanBarcode, Search, CheckCircle2, AlertCircle } from 'lucide-react';

export interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: CreateInventoryItemRequest) => Promise<void> | void;
}

const BARCODE_PRESETS = [
  { label: 'Молоко 2.5%', barcode: '4820000112233' },
  { label: 'Куряче філе', barcode: '4820000112244' },
  { label: 'Вівсянка', barcode: '4820000112255' },
  { label: 'Шпинат', barcode: '4820000112277' },
  { label: 'Гречка', barcode: '4820000112288' },
];

export function AddInventoryModal({ isOpen, onClose, onAdd }: AddInventoryModalProps) {
  const [barcode, setBarcode] = useState('');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [location, setLocation] = useState<StorageLocation>('Fridge');
  const [quantity, setQuantity] = useState<string>('500');
  const [unit, setUnit] = useState<MeasurementUnit>('g');
  const [expiryDays, setExpiryDays] = useState<number>(3);
  const [errorName, setErrorName] = useState<string | null>(null);
  const [errorQuantity, setErrorQuantity] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBarcodeLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcode).trim();
    if (!code) return;

    setIsSearchingBarcode(true);
    setBarcodeMessage(null);

    try {
      const product = await ediensApi.products.getByBarcode(code);
      setProductName(product.name);
      setProductId(product.id);
      setBarcode(code);

      // Auto-select location & unit based on product characteristics
      const lowerName = product.name.toLowerCase();
      if (lowerName.includes('молоко') || lowerName.includes('напій') || lowerName.includes('сік')) {
        setUnit('ml');
        setLocation('Fridge');
        setExpiryDays(4);
      } else if (lowerName.includes('крупа') || lowerName.includes('пластівці') || lowerName.includes('борошно')) {
        setUnit('g');
        setLocation('Pantry');
        setExpiryDays(90);
      } else if (lowerName.includes('філе') || lowerName.includes('м\'ясо') || lowerName.includes('риба')) {
        setUnit('g');
        setLocation('Fridge');
        setExpiryDays(2);
      } else if (lowerName.includes('яйця')) {
        setUnit('pcs');
        setLocation('Fridge');
        setExpiryDays(14);
      } else {
        setUnit('g');
        setLocation('Fridge');
        setExpiryDays(5);
      }

      setBarcodeMessage({
        text: `✓ Знайдено в каталозі: «${product.name}» (${product.brand || 'Локальна база'}) • ${product.caloriesPer100g} ккал/100г`,
        isError: false,
      });
      setErrorName(null);
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Штрих-код не знайдено в каталозі';
      setBarcodeMessage({
        text: msg,
        isError: true,
      });
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSubmitting(true);
    try {
      await onAdd({
        householdId: DEFAULT_HOUSEHOLD_ID,
        productId: productId || null,
        productName: productName.trim(),
        location,
        quantity: qty,
        unit,
        expiresAt,
      });

      // Reset form
      setBarcode('');
      setBarcodeMessage(null);
      setProductId(null);
      setProductName('');
      setQuantity('500');
      setExpiryDays(3);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка додавання партії';
      setErrorName(msg);
    } finally {
      setIsSubmitting(false);
    }
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
        {/* Barcode Search & Fast Autofill */}
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <ScanBarcode className="h-4 w-4 text-sky-400" />
              <span>Сканування штрих-коду EAN-13:</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">OpenFoodFacts & Local DB</span>
          </div>

          <div className="flex gap-2">
            <Input
              id="barcode-input"
              placeholder="Введіть 8–13 цифр (наприклад, 4820000112233)..."
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                if (barcodeMessage) setBarcodeMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeLookup();
                }
              }}
              prefixIcon={<ScanBarcode className="h-4 w-4 text-zinc-500" />}
              className="text-xs font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Search className="h-3.5 w-3.5" />}
              onClick={() => handleBarcodeLookup()}
              disabled={isSearchingBarcode || !barcode.trim()}
            >
              {isSearchingBarcode ? 'Пошук...' : 'Знайти'}
            </Button>
          </div>

          {/* Quick presets for seeded products */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-amber-400" />
              <span>Швидкий EAN:</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {BARCODE_PRESETS.map((p) => (
                <button
                  key={p.barcode}
                  type="button"
                  onClick={() => handleBarcodeLookup(p.barcode)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barcode Lookup Result Message */}
          {barcodeMessage && (
            <div
              className={`text-xs px-2.5 py-1.5 rounded border flex items-center gap-1.5 animate-fade-in ${
                barcodeMessage.isError
                  ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
              }`}
            >
              {barcodeMessage.isError ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              )}
              <span>{barcodeMessage.text}</span>
            </div>
          )}
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
              { label: '+90 днів', days: 90 },
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
                year: 'numeric',
              })}
            </span>
          </div>
        </FormField>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-900">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Скасувати
          </Button>
          <Button variant="default" size="sm" type="submit" icon={<Plus className="h-4 w-4" />} disabled={isSubmitting}>
            {isSubmitting ? 'Збереження...' : 'Додати в інвентар'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
