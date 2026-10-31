import { useState, useEffect, useCallback } from 'react';
import { NutritionTargets, MacroProgress, MealLog, MealType, MeasurementUnit } from '../../types/api';
import { ediensApi, EdiensApiError } from '../../api/client';
import { MacroRing } from '../../components/ui/MacroRing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MealLogForm } from './MealLogForm';
import { MealHistoryList } from './MealHistoryList';
import { EditTargetsModal } from './EditTargetsModal';
import { Activity, Target, Flame, RotateCcw } from 'lucide-react';

export interface MacroTrackerViewProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

const defaultProgress: MacroProgress = {
  calories: { current: 0, target: 2200, remaining: 2200 },
  protein: { current: 0, target: 160, remaining: 160 },
  fat: { current: 0, target: 65, remaining: 65 },
  carbs: { current: 0, target: 240, remaining: 240 },
};

const defaultTargets: NutritionTargets = {
  targetCalories: 2200,
  targetProtein: 160,
  targetFat: 65,
  targetCarbs: 240,
};

export function MacroTrackerView({ onShowToast }: MacroTrackerViewProps) {
  const [targets, setTargets] = useState<NutritionTargets>(defaultTargets);
  const [progress, setProgress] = useState<MacroProgress>(defaultProgress);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [targetsData, progressData, mealsData] = await Promise.all([
        ediensApi.nutrition.getTargets(),
        ediensApi.nutrition.getProgress(),
        ediensApi.meals.getMeals(),
      ]);

      if (targetsData) {
        setTargets(targetsData);
      }
      if (progressData) {
        setProgress(progressData);
      }
      if (mealsData) {
        setMeals(mealsData);
      }
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Не вдалося завантажити макро-профіль із сервера';
      onShowToast('Помилка завантаження', msg, 'error');
    }
  }, [onShowToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTargets = async (newTargets: NutritionTargets) => {
    try {
      const updated = await ediensApi.nutrition.updateTargets(newTargets);
      setTargets(updated);
      onShowToast('Цілі оновлено', 'Добові норми КБЖВ успішно збережено в профіль.', 'success');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка збереження цілей';
      onShowToast('Помилка', msg, 'error');
    }
  };

  const handleLogMeal = async (mealData: {
    mealType: MealType;
    productName: string;
    quantity: number;
    unit: MeasurementUnit;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    idempotencyKey: string;
  }) => {
    try {
      const response = await ediensApi.meals.logMeal(
        {
          mealType: mealData.mealType,
          items: [
            {
              productName: mealData.productName,
              quantity: mealData.quantity,
              unit: mealData.unit,
            },
          ],
        },
        mealData.idempotencyKey
      );

      onShowToast(
        'Прийом їжі збережено',
        `+${response.calories} ккал додано. Залишок перераховано атомарно.`,
        'success'
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка збереження прийому їжі';
      onShowToast('Помилка логування', msg, 'error');
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/meals/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        throw new Error(`HTTP ${res.status}`);
      }
      setMeals((prev) => prev.filter((m) => m.id !== id));
      onShowToast('Запис видалено', 'Калорії та макроси повернено до доступного бюджету.', 'info');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка видалення запису';
      onShowToast('Помилка', msg, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-amber-500" />
            <span>Трекер макронутрієнтів (КБЖВ)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Контроль добового балансу калорій та макросів з автоматичним перерахунком залишкового бюджету.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Target className="h-3.5 w-3.5 text-amber-400" />}
            onClick={() => setIsEditModalOpen(true)}
          >
            Налаштувати цілі
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => {
              loadData();
              onShowToast('Оновлено', 'Дані КБЖВ синхронізовано із сервером.', 'info');
            }}
          >
            Оновити
          </Button>
        </div>
      </div>

      {/* Top Banner: Ring & Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Concentric Macro Progress Ring Card */}
        <Card className="flex flex-col items-center justify-center p-6 border-zinc-800/80 bg-zinc-950/70">
          <div className="text-center mb-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Добовий баланс</span>
            </div>
            <p className="text-[11px] text-zinc-500">Динамічне концентричне макро-кільце</p>
          </div>

          <MacroRing
            calories={progress.calories}
            protein={progress.protein}
            fat={progress.fat}
            carbs={progress.carbs}
            size={180}
            strokeWidth={10}
            showLegend={false}
          />

          <div className="mt-3 text-center">
            <div className="text-xs font-mono text-zinc-400">
              Залишок бюджету:{' '}
              <span className="font-bold text-amber-400 text-sm">
                {progress.calories.remaining} ккал
              </span>
            </div>
          </div>
        </Card>

        {/* Macro Detail Breakdown 4 Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Calories Card */}
          <Card className="p-4 border-amber-900/30 bg-zinc-950/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Калорії (Energy)
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {Math.round((progress.calories.current / (progress.calories.target || 1)) * 100)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {progress.calories.current}
                </span>
                <span className="text-xs font-mono text-zinc-500">/ {progress.calories.target} ккал</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.calories.current / (progress.calories.target || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 mt-3 pt-2 border-t border-zinc-900 flex justify-between">
              <span>Залишилось:</span>
              <span className="font-semibold text-amber-300">{progress.calories.remaining} ккал</span>
            </div>
          </Card>

          {/* Protein Card */}
          <Card className="p-4 border-sky-900/30 bg-zinc-950/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  Білки (Protein)
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {Math.round((progress.protein.current / (progress.protein.target || 1)) * 100)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {progress.protein.current}г
                </span>
                <span className="text-xs font-mono text-zinc-500">/ {progress.protein.target}г</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-sky-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.protein.current / (progress.protein.target || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 mt-3 pt-2 border-t border-zinc-900 flex justify-between">
              <span>Залишилось:</span>
              <span className="font-semibold text-sky-300">{progress.protein.remaining}г</span>
            </div>
          </Card>

          {/* Fat Card */}
          <Card className="p-4 border-rose-900/30 bg-zinc-950/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Жири (Fat)
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {Math.round((progress.fat.current / (progress.fat.target || 1)) * 100)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {progress.fat.current}г
                </span>
                <span className="text-xs font-mono text-zinc-500">/ {progress.fat.target}г</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-rose-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.fat.current / (progress.fat.target || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 mt-3 pt-2 border-t border-zinc-900 flex justify-between">
              <span>Залишилось:</span>
              <span className="font-semibold text-rose-300">{progress.fat.remaining}г</span>
            </div>
          </Card>

          {/* Carbs Card */}
          <Card className="p-4 border-emerald-900/30 bg-zinc-950/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Вуглеводи (Carbs)
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {Math.round((progress.carbs.current / (progress.carbs.target || 1)) * 100)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {progress.carbs.current}г
                </span>
                <span className="text-xs font-mono text-zinc-500">/ {progress.carbs.target}г</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.carbs.current / (progress.carbs.target || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 mt-3 pt-2 border-t border-zinc-900 flex justify-between">
              <span>Залишилось:</span>
              <span className="font-semibold text-emerald-300">{progress.carbs.remaining}г</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Logging Form & Today's Meals Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MealLogForm onLogMeal={handleLogMeal} />
        <MealHistoryList meals={meals} onDeleteMeal={handleDeleteMeal} />
      </div>

      {/* Edit Targets Modal */}
      <EditTargetsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targets={targets}
        onSave={handleSaveTargets}
      />
    </div>
  );
}
