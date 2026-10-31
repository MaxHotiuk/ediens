import { useState } from 'react';
import { Recipe } from '../../types/api';
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
} from 'lucide-react';

export interface RecipeCardProps {
  recipe: Recipe;
  onCook: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, onCook }: RecipeCardProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isCooking, setIsCooking] = useState(false);

  const isAllAvailable = recipe.ingredients.every((ing) => ing.isAvailable);
  const missingCount = recipe.ingredients.filter((ing) => !ing.isAvailable).length;

  const handleCookClick = async () => {
    setIsCooking(true);
    try {
      onCook(recipe);
    } finally {
      setIsCooking(false);
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

        {/* Macro Pill Ribbon */}
        <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-center font-mono text-xs">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Ккал</div>
            <div className="font-bold text-amber-400 mt-0.5">{recipe.totalCalories}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Біл.</div>
            <div className="font-bold text-sky-300 mt-0.5">{recipe.totalProtein}г</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Жир.</div>
            <div className="font-bold text-rose-300 mt-0.5">{recipe.totalFat}г</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Вуг.</div>
            <div className="font-bold text-emerald-300 mt-0.5">{recipe.totalCarbs}г</div>
          </div>
        </div>

        {/* Ingredients Checklist */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Інгредієнти:
          </div>
          <div className="space-y-1">
            {recipe.ingredients.map((ing, idx) => (
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
                <span className="font-mono text-zinc-400">
                  {ing.quantity} {ing.unit}
                </span>
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
      <div className="pt-4 mt-4 border-t border-zinc-900 flex items-center justify-between gap-2">
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
          {isAllAvailable ? 'Приготувати (1-Click Cook)' : 'Приготувати (422 Тест)'}
        </Button>
      </div>
    </div>
  );
}
