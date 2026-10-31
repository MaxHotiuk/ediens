import React, { useState } from 'react';
import { MealType, MeasurementUnit } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Input, FormField, FormLabel, FormError } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Utensils, Plus, Sparkles, Key } from 'lucide-react';
import { generateUuid } from '../../api/client';

export interface MealLogFormProps {
  onLogMeal: (meal: {
    mealType: MealType;
    productName: string;
    quantity: number;
    unit: MeasurementUnit;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    idempotencyKey: string;
  }) => void;
}

const QUICK_MEALS = [
  { name: 'Вівсянка з бананом та медом', type: 'Breakfast' as MealType, qty: 250, unit: 'g' as MeasurementUnit, cal: 320, p: 11, f: 5, c: 58 },
  { name: 'Омлет з 3 яєць зі шпинатом', type: 'Breakfast' as MealType, qty: 180, unit: 'g' as MeasurementUnit, cal: 260, p: 22, f: 18, c: 3 },
  { name: 'Куряче філе на пару з рисом', type: 'Lunch' as MealType, qty: 350, unit: 'g' as MeasurementUnit, cal: 520, p: 48, f: 8, c: 62 },
  { name: 'Сир кисломолочний 5% з ягодами', type: 'Snack' as MealType, qty: 200, unit: 'g' as MeasurementUnit, cal: 230, p: 28, f: 6, c: 14 },
  { name: 'Запечений лосось з овочами', type: 'Dinner' as MealType, qty: 300, unit: 'g' as MeasurementUnit, cal: 480, p: 42, f: 22, c: 16 },
];

export function MealLogForm({ onLogMeal }: MealLogFormProps) {
  const [mealType, setMealType] = useState<MealType>('Breakfast');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<string>('200');
  const [unit, setUnit] = useState<MeasurementUnit>('g');
  const [calories, setCalories] = useState<string>('300');
  const [protein, setProtein] = useState<string>('25');
  const [fat, setFat] = useState<string>('8');
  const [carbs, setCarbs] = useState<string>('30');
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateUuid());

  const handleSelectQuick = (meal: typeof QUICK_MEALS[0]) => {
    setProductName(meal.name);
    setMealType(meal.type);
    setQuantity(String(meal.qty));
    setUnit(meal.unit);
    setCalories(String(meal.cal));
    setProtein(String(meal.p));
    setFat(String(meal.f));
    setCarbs(String(meal.c));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Вкажіть назву страви або продукту.');
      return;
    }

    const qty = parseFloat(quantity);
    const cal = parseFloat(calories);
    const p = parseFloat(protein);
    const f = parseFloat(fat);
    const c = parseFloat(carbs);

    if (isNaN(qty) || qty <= 0 || isNaN(cal) || cal < 0) {
      setError('Некоректні параметри страви (VALIDATION_FAILED: quantity > 0, calories >= 0).');
      return;
    }

    setError(null);

    onLogMeal({
      mealType,
      productName: productName.trim(),
      quantity: qty,
      unit,
      calories: Math.round(cal),
      protein: Math.round(p || 0),
      fat: Math.round(f || 0),
      carbs: Math.round(c || 0),
      idempotencyKey,
    });

    // Reset with new UUID for next entry
    setProductName('');
    setIdempotencyKey(generateUuid());
  };

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Utensils className="h-4 w-4 text-emerald-400" />
            <span>Логування прийому їжі</span>
          </CardTitle>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            <Key className="h-2.5 w-2.5 text-zinc-400" />
            <span>Idempotency-Key: {idempotencyKey.slice(0, 8)}...</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Quick Presets */}
        <div className="mb-4">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Швидкий вибір популярних страв:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MEALS.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => handleSelectQuick(m)}
                className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Meal Type Tabs */}
          <div>
            <FormLabel>Тип прийому їжі:</FormLabel>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {(
                [
                  { id: 'Breakfast', label: 'Сніданок' },
                  { id: 'Lunch', label: 'Обід' },
                  { id: 'Dinner', label: 'Вечеря' },
                  { id: 'Snack', label: 'Перекус' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMealType(tab.id)}
                  className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    mealType === tab.id
                      ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <FormField>
                <FormLabel htmlFor="meal-name" required>
                  Назва страви / продукту:
                </FormLabel>
                <Input
                  id="meal-name"
                  placeholder="Наприклад: Вівсянка з ягодами"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </FormField>
            </div>

            <div>
              <FormField>
                <FormLabel htmlFor="meal-qty" required>
                  Порція:
                </FormLabel>
                <div className="flex gap-1.5">
                  <Input
                    id="meal-qty"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
                    className="w-16 rounded-lg bg-zinc-950 border border-zinc-800 px-2 text-xs font-mono text-zinc-100 outline-none"
                  >
                    <option value="g">г</option>
                    <option value="ml">мл</option>
                    <option value="pcs">шт</option>
                  </select>
                </div>
              </FormField>
            </div>
          </div>

          {/* Nutritional Breakdown Inputs */}
          <div>
            <FormLabel>Розрахунок нутрієнтів (КБЖВ):</FormLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1">
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-amber-900/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400">Калорії (ккал)</span>
                <input
                  type="number"
                  min="0"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm font-mono text-amber-300"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-sky-900/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-sky-400">Білки (г)</span>
                <input
                  type="number"
                  min="0"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm font-mono text-sky-300"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-rose-900/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-rose-400">Жири (г)</span>
                <input
                  type="number"
                  min="0"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm font-mono text-rose-300"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-emerald-900/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400">Вуглеводи (г)</span>
                <input
                  type="number"
                  min="0"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm font-mono text-emerald-300"
                />
              </div>
            </div>
          </div>

          {error && <FormError message={error} />}

          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              size="sm"
              type="submit"
              icon={<Plus className="h-4 w-4 text-zinc-950" />}
            >
              Залогувати прийом їжі
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
