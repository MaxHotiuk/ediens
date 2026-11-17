import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, FormField, FormLabel, FormError } from '../../components/ui/Input';
import { InventoryItem, StorageLocation } from '../../types/api';
import { ediensApi, EdiensApiError } from '../../api/client';
import { Refrigerator, Archive, Snowflake, Calendar, Check, Loader2, ShieldCheck } from 'lucide-react';

export interface EditInventoryModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (updatedItem: InventoryItem) => void;
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
  onConflict?: (item: InventoryItem, serverQuantity: number, currentETag: string, attemptedQuantity: number, modifiedBy?: string) => void;
}

export function EditInventoryModal({
  isOpen,
  item,
  onClose,
  onSave,
  onShowToast,
  onConflict,
}: EditInventoryModalProps) {
  const [location, setLocation] = useState<StorageLocation>('Fridge');
  const [quantity, setQuantity] = useState<string>('0');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [errorQuantity, setErrorQuantity] = useState<string | null>(null);
  const [errorExpiresAt, setErrorExpiresAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setLocation(item.location);
      setQuantity(item.quantity.toString());
      if (item.expiresAt) {
        const d = new Date(item.expiresAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setExpiresAt(`${yyyy}-${mm}-${dd}`);
      } else {
        setExpiresAt('');
      }
      setErrorQuantity(null);
      setErrorExpiresAt(null);
    }
  }, [item]);

  if (!item) return null;

  const handleAddDays = (days: number) => {
    const base = expiresAt ? new Date(expiresAt) : new Date();
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    setExpiresAt(`${yyyy}-${mm}-${dd}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorQuantity(null);
    setErrorExpiresAt(null);

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum < 0) {
      setErrorQuantity('Кількість не може бути від\'ємною');
      return;
    }

    if (!expiresAt) {
      setErrorExpiresAt('Вкажіть термін придатності');
      return;
    }

    setIsSubmitting(true);
    try {
      const expirationDateIso = new Date(`${expiresAt}T23:59:59.000Z`).toISOString();
      const updated = await ediensApi.inventory.updateItem(
        item.id,
        {
          location,
          quantity: qtyNum,
          expiresAt: expirationDateIso,
        },
        item.etag
      );

      onShowToast(
        'Партію оновлено',
        `«${item.productName}» успішно оновлено (${qtyNum} ${item.unit}, ${location}).`,
        'success'
      );
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof EdiensApiError && err.status === 409) {
        const ext = err.problem?.extensions as Record<string, unknown> | undefined;
        const serverQty = typeof ext?.currentQuantity === 'number' ? ext.currentQuantity : item.quantity;
        const currentETag = typeof ext?.currentETag === 'string' ? ext.currentETag : item.etag;
        const modifiedBy = typeof ext?.lastModifiedBy === 'string' ? ext.lastModifiedBy : 'іншим учасником домогосподарства';

        onClose();
        if (onConflict) {
          onConflict(item, serverQty, currentETag, qtyNum, modifiedBy);
        } else {
          onShowToast('Конфлікт 409', 'Партію було змінено паралельно. Оновіть сторінку.', 'warning');
        }
      } else {
        const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка оновлення партії';
        onShowToast('Помилка', msg, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Редагувати партію продукту</span>
        </div>
      }
      description={`Зміна параметрів партії «${item.productName}» з оптимістичним контролем версій.`}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
            <span>ETag: {item.etag}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Скасувати
            </Button>
            <Button
              variant="default"
              size="sm"
              icon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-zinc-950" /> : <Check className="h-4 w-4 text-zinc-950" />}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Збереження...' : 'Зберегти зміни'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Product Name Display */}
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Продукт</div>
            <div className="text-sm font-semibold text-zinc-100 mt-0.5">{item.productName}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-zinc-500">Одиниця виміру</div>
            <div className="text-sm font-bold font-mono text-sky-400">{item.unit}</div>
          </div>
        </div>

        {/* Location selector */}
        <FormField>
          <FormLabel>Локація зберігання</FormLabel>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {[
              { id: 'Fridge', label: 'Холодильник', icon: <Refrigerator className="h-4 w-4 text-sky-400" /> },
              { id: 'Freezer', label: 'Морозилка', icon: <Snowflake className="h-4 w-4 text-cyan-400" /> },
              { id: 'Pantry', label: 'Комора', icon: <Archive className="h-4 w-4 text-amber-400" /> },
            ].map((loc) => (
              <button
                type="button"
                key={loc.id}
                onClick={() => setLocation(loc.id as StorageLocation)}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  location === loc.id
                    ? 'border-sky-500 bg-sky-950/30 text-white shadow-sm ring-1 ring-sky-500/50'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {loc.icon}
                <span>{loc.label}</span>
              </button>
            ))}
          </div>
        </FormField>

        {/* Quantity */}
        <FormField>
          <FormLabel required>Точна кількість ({item.unit})</FormLabel>
          <div className="relative mt-1">
            <Input
              type="number"
              step="any"
              min="0"
              value={quantity}
              error={errorQuantity || undefined}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (errorQuantity) setErrorQuantity(null);
              }}
              placeholder="0"
              className="font-mono text-base pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500 pointer-events-none">
              {item.unit}
            </span>
          </div>
          {parseFloat(quantity) === 0 && (
            <p className="text-[11px] text-amber-400 mt-1">
              ⚠️ При кількості 0 партія буде автоматично списана та видалена зі складу.
            </p>
          )}
          {errorQuantity && <FormError message={errorQuantity} />}
        </FormField>

        {/* Expiration Date */}
        <FormField>
          <FormLabel required>Термін придатності (Expires At)</FormLabel>
          <div className="relative mt-1">
            <Input
              type="date"
              value={expiresAt}
              error={errorExpiresAt || undefined}
              onChange={(e) => {
                setExpiresAt(e.target.value);
                if (errorExpiresAt) setErrorExpiresAt(null);
              }}
              prefixIcon={<Calendar className="h-4 w-4 text-zinc-400" />}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
            <span className="text-[11px] text-zinc-500">Додати:</span>
            {[
              { label: '+1 д', days: 1 },
              { label: '+3 д', days: 3 },
              { label: '+7 д', days: 7 },
              { label: '+30 д', days: 30 },
            ].map((preset) => (
              <button
                type="button"
                key={preset.label}
                onClick={() => handleAddDays(preset.days)}
                className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {errorExpiresAt && <FormError message={errorExpiresAt} />}
        </FormField>
      </form>
    </Modal>
  );
}
