import { MealLog } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Trash2, Clock, Calendar } from 'lucide-react';

export interface MealHistoryListProps {
  meals: MealLog[];
  onDeleteMeal: (id: string) => void;
}

export function MealHistoryList({ meals, onDeleteMeal }: MealHistoryListProps) {
  const getMealTypeBadge = (type: string) => {
    switch (type) {
      case 'Breakfast':
        return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/50">Сніданок</span>;
      case 'Lunch':
        return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950/40 text-sky-300 border border-sky-800/50">Обід</span>;
      case 'Dinner':
        return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/50">Вечеря</span>;
      default:
        return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">Перекус</span>;
    }
  };

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-400" />
            <span>Історія прийомів їжі за сьогодні</span>
          </CardTitle>
          <span className="text-xs font-mono text-zinc-500">
            {meals.length} запис(ів)
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {meals.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
            <Calendar className="h-8 w-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400">Сьогодні ще не залоговано жодного прийому їжі.</p>
            <p className="text-[11px] text-zinc-600">
              Використайте форму вище або приготуйте страву через 1-Click Cook на вкладці «Рецепти».
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70 hover:border-zinc-700 transition-all gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getMealTypeBadge(meal.mealType)}
                    <span className="text-xs font-mono text-zinc-500">
                      {new Date(meal.loggedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="font-medium text-sm text-zinc-200">
                    {meal.items && meal.items.length > 0
                      ? meal.items.map((i) => `${i.productName} (${i.quantity}${i.unit})`).join(', ')
                      : 'Прийом їжі'}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-amber-400 font-bold">{meal.calories} ккал</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-sky-300">Б: {meal.protein}г</span>
                    <span className="text-rose-300">Ж: {meal.fat}г</span>
                    <span className="text-emerald-300">В: {meal.carbs}г</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 p-1.5 h-7 w-7"
                    onClick={() => onDeleteMeal(meal.id)}
                    title="Видалити запис зі щоденника"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
