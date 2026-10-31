import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, FormField, FormLabel, FormError } from '../../components/ui/Input';
import { NutritionTargets } from '../../types/api';
import { Target, Check } from 'lucide-react';

export interface EditTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: NutritionTargets;
  onSave: (targets: NutritionTargets) => void;
}

export function EditTargetsModal({ isOpen, onClose, targets, onSave }: EditTargetsModalProps) {
  const [calories, setCalories] = useState(String(targets.targetCalories));
  const [protein, setProtein] = useState(String(targets.targetProtein));
  const [fat, setFat] = useState(String(targets.targetFat));
  const [carbs, setCarbs] = useState(String(targets.targetCarbs));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseFloat(calories);
    const p = parseFloat(protein);
    const f = parseFloat(fat);
    const cb = parseFloat(carbs);

    if (isNaN(c) || c <= 0 || isNaN(p) || p <= 0 || isNaN(f) || f <= 0 || isNaN(cb) || cb <= 0) {
      setError('Всі цільові значення повинні бути додатними числами (VALIDATION_FAILED).');
      return;
    }

    setError(null);
    onSave({
      ...targets,
      targetCalories: Math.round(c),
      targetProtein: Math.round(p),
      targetFat: Math.round(f),
      targetCarbs: Math.round(cb),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-400" />
          <span>Налаштувати добові макро-цілі (КБЖВ)</span>
        </div>
      }
      description="Встановіть індивідуальні добові цілі споживання для розрахунку залишку бюджету."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <FormField>
          <FormLabel htmlFor="target-calories" required>
            Цільові калорії (ккал / день):
          </FormLabel>
          <Input
            id="target-calories"
            type="number"
            min="500"
            max="10000"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            suffix="ккал"
          />
        </FormField>

        <div className="grid grid-cols-3 gap-2.5">
          <FormField>
            <FormLabel htmlFor="target-protein" required>
              Білки:
            </FormLabel>
            <Input
              id="target-protein"
              type="number"
              min="10"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              suffix="г"
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="target-fat" required>
              Жири:
            </FormLabel>
            <Input
              id="target-fat"
              type="number"
              min="5"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              suffix="г"
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="target-carbs" required>
              Вуглеводи:
            </FormLabel>
            <Input
              id="target-carbs"
              type="number"
              min="10"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              suffix="г"
            />
          </FormField>
        </div>

        {error && <FormError message={error} />}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-900">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Скасувати
          </Button>
          <Button variant="default" size="sm" type="submit" icon={<Check className="h-4 w-4" />}>
            Зберегти цілі
          </Button>
        </div>
      </form>
    </Modal>
  );
}
