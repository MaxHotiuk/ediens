import { useState, useEffect, useCallback } from 'react';
import { Recipe, InsufficientInventoryExtensions } from '../../types/api';
import { ediensApi, DEFAULT_HOUSEHOLD_ID, EdiensApiError, generateUuid } from '../../api/client';
import { RecipeCard } from './RecipeCard';
import { MissingIngredientsModal } from './MissingIngredientsModal';
import { Sparkles, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

export interface RecipeRecommendationViewProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToShoppingList?: () => void;
}

export function RecipeRecommendationView({
  onShowToast,
  onNavigateToShoppingList,
}: RecipeRecommendationViewProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'quick' | 'highProtein'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // 422 Missing Ingredients Modal State
  const [missingModalData, setMissingModalData] = useState<{
    recipeTitle: string;
    missingIngredients: InsufficientInventoryExtensions['missingIngredients'];
  } | null>(null);

  const loadRecipes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ediensApi.recipes.getRecommendations({ householdId: DEFAULT_HOUSEHOLD_ID });
      setRecipes(data);
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Не вдалося завантажити рекомендації рецептів';
      onShowToast('Помилка', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleCook = async (recipe: Recipe, servings: number = 1, mealType: string = 'Dinner') => {
    try {
      const result = await ediensApi.recipes.cookRecipe(recipe.id, {
        householdId: DEFAULT_HOUSEHOLD_ID,
        servings,
        mealType,
      });

      const mealTypeMap: Record<string, string> = {
        Breakfast: 'Сніданок',
        Lunch: 'Обід',
        Dinner: 'Вечеря',
        Snack: 'Перекус',
      };
      const mealTypeLabel = mealTypeMap[result.mealType || mealType] || result.mealType || mealType;
      const actualServings = result.servingsCooked || servings;
      const calories = result.loggedMacros?.calories ?? Math.round(recipe.totalCalories * servings);
      const protein = result.loggedMacros?.protein ?? Number((recipe.totalProtein * servings).toFixed(1));

      onShowToast(
        '1-Click Cook виконано!',
        `Страву «${recipe.title}» (${actualServings} порц., ${mealTypeLabel}) успішно приготовано! Списано запаси за FEFO, а КБЖВ (+${calories} ккал, +${protein}г білка) додано до щоденника.`,
        'success'
      );

      // Refresh recipes recommendations, inventory stock, and macro progress
      await Promise.allSettled([
        loadRecipes(),
        ediensApi.inventory.getItems({ householdId: DEFAULT_HOUSEHOLD_ID }),
        ediensApi.nutrition.getProgress(),
      ]);

      // Broadcast events so other views/tabs also refresh
      window.dispatchEvent(new CustomEvent('ediens:refresh-data'));
      window.dispatchEvent(new CustomEvent('ediens:inventory-updated'));
      window.dispatchEvent(new CustomEvent('ediens:macros-updated'));
    } catch (err: unknown) {
      if (err instanceof EdiensApiError && err.status === 422) {
        const ext = err.problem?.extensions as Record<string, unknown> | undefined;
        const missing = (ext?.missingIngredients || []) as InsufficientInventoryExtensions['missingIngredients'];
        setMissingModalData({
          recipeTitle: recipe.title,
          missingIngredients: missing,
        });
      } else {
        const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка виконання 1-Click Cook';
        onShowToast('Помилка', msg, 'error');
      }
    }
  };

  const handleAddToShoppingList = async (
    missing: InsufficientInventoryExtensions['missingIngredients']
  ) => {
    try {
      const clientChanges = missing.map((m) => ({
        id: generateUuid(),
        productName: m.productName,
        quantity: Math.max(1, m.requiredQuantity - (m.availableQuantity || 0)),
        unit: m.unit,
        isPurchased: false,
        clientUpdatedAt: new Date().toISOString(),
      }));

      await ediensApi.shoppingList.sync(DEFAULT_HOUSEHOLD_ID, {
        clientChanges,
      });

      onShowToast(
        'Додано до списку покупок',
        `${missing.length} інгредієнт(ів) успішно внесено до списку покупок домогосподарства.`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof EdiensApiError ? (err.problem?.detail || err.message) : 'Помилка додавання до списку покупок';
      onShowToast('Помилка', msg, 'error');
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    if (filterMode === 'available') {
      return (r.ingredients || []).every((ing) => ing.isAvailable);
    }
    if (filterMode === 'quick') {
      return r.prepTimeMinutes <= 15;
    }
    if (filterMode === 'highProtein') {
      return r.totalProtein >= 30;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-amber-400" />
            <span>Розумні рецепти & 1-Click Cook</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Алгоритмічний підбір страв на основі продуктів, що спливають (FEFO), та залишку денного макро-бюджету.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Транзакційне списання FEFO</span>
          </div>
          <button
            type="button"
            onClick={() => loadRecipes()}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Оновити рекомендації"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Formula Explanation Ribbon */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>Формула ранжування AI-рекомендацій:</span>
          </div>
          <p className="text-zinc-400 font-mono text-[11px]">
            Score = w₁ · ExpiringStockMatch + w₂ · MacroBudgetFit - w₃ · MissingIngredientsCount
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Пріоритет: швидке споживання залишків холодильника</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Всі рецепти' },
          { id: 'available', label: '100% в наявності' },
          { id: 'quick', label: 'Швидкі (≤ 15 хв)' },
          { id: 'highProtein', label: 'Високобілкові (≥ 30г)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterMode(tab.id as typeof filterMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === tab.id
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onCook={handleCook}
            onAddShortfall={async (items) => {
              await handleAddToShoppingList(
                items.map((i) => ({
                  productId: i.productId,
                  productName: i.productName,
                  requiredQuantity: i.requiredQuantity,
                  availableQuantity: i.availableQuantity,
                  unit: i.unit,
                }))
              );
            }}
          />
        ))}
      </div>

      {/* 422 Missing Ingredients Modal */}
      {missingModalData && (
        <MissingIngredientsModal
          isOpen={Boolean(missingModalData)}
          onClose={() => setMissingModalData(null)}
          recipeTitle={missingModalData.recipeTitle}
          missingIngredients={missingModalData.missingIngredients}
          onAddToShoppingList={handleAddToShoppingList}
          onNavigateToShoppingList={onNavigateToShoppingList}
        />
      )}
    </div>
  );
}
