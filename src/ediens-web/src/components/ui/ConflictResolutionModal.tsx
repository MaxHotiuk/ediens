import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, FormField, FormLabel } from './Input';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { MeasurementUnit } from '../../types/api';

export interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  attemptedQuantity: number;
  currentServerQuantity: number;
  unit: MeasurementUnit | string;
  currentETag?: string;
  modifiedBy?: string;
  onAcceptServer: () => void;
  onReapplyWithServerQuantity: (newQuantity: number, newETag?: string) => void;
  onCancel?: () => void;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  itemName,
  attemptedQuantity,
  currentServerQuantity,
  unit,
  currentETag,
  modifiedBy = 'іншим учасником домогосподарства',
  onAcceptServer,
  onReapplyWithServerQuantity,
  onCancel,
}: ConflictResolutionModalProps) {
  const [adjustedQuantity, setAdjustedQuantity] = useState<number>(() => {
    // Default to deducting the same relative amount or setting server quantity
    return Math.max(0, currentServerQuantity);
  });

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const handleAcceptServer = () => {
    onAcceptServer();
    onClose();
  };

  const handleApplyAdjusted = () => {
    onReapplyWithServerQuantity(adjustedQuantity, currentETag);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Конфлікт паралельного редагування (409 Conflict)</span>
        </div>
      }
      description={
        <span>
          Дані товару <strong>«{itemName}»</strong> були змінені {modifiedBy} після того,
          як ви відкрили сторінку.
        </span>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Скасувати
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAcceptServer}>
              Прийняти стан сервера
            </Button>
            <Button
              variant="default"
              size="sm"
              icon={<Check className="h-4 w-4" />}
              onClick={handleApplyAdjusted}
            >
              Застосувати корекцію
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        {/* Version Comparison Card */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Ваша попередня спроба
            </div>
            <div className="text-xl font-bold font-mono text-zinc-300">
              {attemptedQuantity} <span className="text-sm font-normal text-zinc-500">{unit}</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">Версія застаріла</div>
          </div>

          <div className="space-y-1 border-l border-zinc-800/80 pl-3.5">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span>Актуально на сервері</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              {currentServerQuantity} <span className="text-sm font-normal text-amber-400/70">{unit}</span>
            </div>
            {currentETag && (
              <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                <span>ETag (xmin):</span>
                <span className="text-zinc-300 bg-zinc-800 px-1.5 py-0.2 rounded">{currentETag}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Choice: Re-adjust quantity */}
        <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/70">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
            <span>Скоригувати новий залишок для збереження:</span>
          </div>

          <FormField>
            <FormLabel htmlFor="adjusted-quantity">Нова кількість після вашої зміни:</FormLabel>
            <Input
              id="adjusted-quantity"
              type="number"
              min="0"
              max={currentServerQuantity}
              step="any"
              value={adjustedQuantity}
              onChange={(e) => setAdjustedQuantity(parseFloat(e.target.value) || 0)}
              suffix={unit}
            />
          </FormField>
          <p className="text-[11px] text-zinc-500">
            Операція буде виконана атомарно з новим заголовком <code className="text-zinc-400 font-mono">If-Match: {currentETag || 'W/\"...\"'}</code>.
          </p>
        </div>
      </div>
    </Modal>
  );
}
