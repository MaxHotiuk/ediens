import { useState } from 'react';
import { Recipe, MeasurementUnit } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  UtensilsCrossed,
  Minus,
  Plus,
  ShoppingCart,
  Users,
} from 'lucide-react';

export interface RecipeShortfallItem {
  productId: string;
  productName: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortfall: number;
  unit: MeasurementUnit;
}

export interface RecipeCardProps {
  recipe: Recipe;
  onCook: (recipe: Recipe, servings: number, mealType: string) => Promise<void> | void;
  onAddShortfall?: (items: RecipeShortfallItem[]) => Promise<void> | void;
}

export const MEAL_TYPES = [
  { value: 'Breakfast', label: 'Сніданок' },
  { value: 'Lunch', label: 'Обід' },
  { value: 'Dinner', label: 'Вечеря' },
  { value: 'Snack', label: 'Перекус' },
] as const;

export function RecipeCard({ recipe, onCook, onAddShortfall }: RecipeCardProps) {
  const [servings, setServings] = useState<number>(1);
  const [mealType, setMealType] = useState<string>('Dinner');
  const [showInstructions, setShowInstructions] = useState(false);
  const [isCooking, setIsCooking] = useState(false);
  const [isAddingShortfall, setIsAddingShortfall] = useState(false);

  // Recalculate dynamic macros based on servings (1 to 8 portions)
  const scaledCalories = Math.round(recipe.totalCalories * servings);
  const scaledProtein = Number((recipe.totalProtein * servings).toFixed(1));
  const scaledFat = Number((recipe.totalFat * servings).toFixed(1));
  const scaledCarbs = Number((recipe.totalCarbs * servings).toFixed(1));

  // Recalculate ingredients, availability and shortfalls for the chosen servings count
  const computedIngredients = recipe.ingredients.map((ing) => {
    const available =
      (ing as { availableQuantity?: number }).availableQuantity !== undefined
        ? Number((ing as { availableQuantity?: number }).availableQuantity)
        : ing.isAvailable
        ? Number(ing.quantity)
        : 0;

    const required = Number((ing.quantity * servings).toFixed(1));
    const shortfall = Math.max(0, Number((required - available).toFixed(1)));
    const isAvailable = available >= required;

    return {
      productId: ing.productId,
      productName: ing.productName,
      requiredQuantity: required,
      availableQuantity: available,
      shortfall,
      unit: ing.unit,
      isAvailable,
    };
  });

  const missingShortfallItems = computedIngredients.filter((item) => item.shortfall > 0);
  const isAllAvailable = missingShortfallItems.length === 0;
  const missingCount = missingShortfallItems.length;

  const handleCookClick = async () => {
    setIsCooking(true);
    try {
      await onCook(recipe, servings, mealType);
    } finally {
      setIsCooking(false);
    }
  };

  const handleBuyShortfallClick = async () => {
    if (missingShortfallItems.length === 0 || !onAddShortfall) return;
    setIsAddingShortfall(true);
    try {
      await onAddShortfall(missingShortfallItems);
    } finally {
      setIsAddingShortfall(false);
    }
  };

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/40 hover:shadow-xl hover:shadow-black/50 flex flex-col justify-between">
      <div className="space-y-4">
        {/* Top Badges: Score & Prep Time */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={isAllAvailable ? 'fefo-fresh' : 'fefo-warning'}
            dot
            className="text-[11px] font-mono"
          >
            {isAllAvailable ? '100% в наявності' : `Бракує: ${missingCount}`}
          </Badge>

          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            <Clock className="h-3 w-3 text-sky-400" />
            <span>{recipe.prepTimeMinutes} хв</span>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-zinc-100 text-base tracking-tight group-hover:text-white">
              {recipe.title}
            </h3>
            {recipe.expiringStockMatchScore && recipe.expiringStockMatchScore > 90 && (
              <span className="shrink-0 text-[10px] font-mono font-bold text-amber-300 bg-amber-950/50 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                FEFO: {recipe.expiringStockMatchScore}%
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mt-1.5 line-clamp-2">
            {recipe.description}
          </p>
        </div>

        {/* Servings Stepper & Meal Type Dispatch Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60">
          {/* Servings Stepper (1 to 8 portions) */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Users className="h-3.5 w-3.5 text-sky-400" />
              <span>Порції:</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-950 rounded-lg border border-zinc-800 p-0.5">
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                disabled={servings <= 1}
                aria-label="Зменшити порції"
                className="h-6 w-6 rounded flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-300 transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="font-mono font-bold text-xs text-white min-w-[3.5rem] text-center">
                {servings} {servings === 1 ? 'порція' : servings < 5 ? 'порції' : 'порцій'}
              </span>
              <button
                type="button"
                onClick={() => setServings((s) => Math.min(8, s + 1))}
                disabled={servings >= 8}
                aria-label="Збільшити порції"
                className="h-6 w-6 rounded flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-300 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Meal Type Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px]">
            {MEAL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setMealType(t.value)}
                className={`flex-1 py-1 px-1 rounded font-medium text-center transition-all ${
                  mealType === t.value
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/80 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Macro Pill Ribbon */}
        <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-center font-mono text-xs">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Ккал</div>
            <div className="font-bold text-amber-400 mt-0.5">{scaledCalories}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Біл.</div>
            <div className="font-bold text-sky-300 mt-0.5">{scaledProtein}г</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Жир.</div>
            <div className="font-bold text-rose-300 mt-0.5">{scaledFat}г</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Вуг.</div>
            <div className="font-bold text-emerald-300 mt-0.5">{scaledCarbs}г</div>
          </div>
        </div>

        {/* Dynamic Ingredients Checklist */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            <span>Інгредієнти ({servings}x):</span>
            {!isAllAvailable && (
              <span className="text-amber-400/90 lowercase text-[11px] font-normal">
                {missingCount} бракує
              </span>
            )}
          </div>
          <div className="space-y-1">
            {computedIngredients.map((ing, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <div className="flex items-center gap-1.5 text-zinc-300">
                  {ing.isAvailable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className={ing.isAvailable ? '' : 'text-zinc-400'}>
                    {ing.productName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className={ing.isAvailable ? 'text-zinc-400' : 'text-zinc-300 font-medium'}>
                    {ing.requiredQuantity} {ing.unit}
                  </span>
                  {ing.shortfall > 0 && (
                    <span className="text-[10px] text-rose-400 bg-rose-950/40 px-1 py-0.2 rounded border border-rose-900/40">
                      - {ing.shortfall} {ing.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions Collapsible */}
        {showInstructions && (
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 whitespace-pre-line animate-fade-in leading-relaxed">
            <div className="font-semibold text-zinc-100 mb-1">Інструкція приготування:</div>
            {recipe.instructions}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="pt-4 mt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-medium transition-colors"
        >
          <span>{showInstructions ? 'Сховати рецепт' : 'Інструкція'}</span>
          {showInstructions ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex items-center gap-2 justify-end">
          {/* 1-Click Shortfall Purchase Button (when missing ingredients) */}
          {!isAllAvailable && onAddShortfall && (
            <Button
              variant="outline"
              size="sm"
              loading={isAddingShortfall}
              icon={<ShoppingCart className="h-3.5 w-3.5 text-amber-400" />}
              onClick={handleBuyShortfallClick}
              className="text-xs border-amber-800/60 text-amber-300 hover:bg-amber-950/40 font-medium"
            >
              Купити бракуючі ({missingCount})
            </Button>
          )}

          {/* Clean User-Facing Cook Button */}
          <Button
            variant={isAllAvailable ? 'default' : 'secondary'}
            size="sm"
            loading={isCooking}
            icon={
              isAllAvailable ? (
                <UtensilsCrossed className="h-3.5 w-3.5 text-zinc-950" />
              ) : (
                <Flame className="h-3.5 w-3.5 text-amber-400" />
              )
            }
            onClick={handleCookClick}
            className="text-xs"
          >
            {isAllAvailable ? 'Приготувати (1-Click Cook)' : 'Не вистачає інгредієнтів'}
          </Button>
        </div>
      </div>
    </div>
  );
}

