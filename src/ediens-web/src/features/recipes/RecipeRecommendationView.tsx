import { useState, useEffect } from 'react';
import { Recipe, InsufficientInventoryExtensions } from '../../types/api';
import { ediensStore } from '../store/mockStore';
import { RecipeCard } from './RecipeCard';
import { MissingIngredientsModal } from './MissingIngredientsModal';
import { Sparkles, ShieldCheck, Zap } from 'lucide-react';

export interface RecipeRecommendationViewProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToShoppingList?: () => void;
}

export function RecipeRecommendationView({
  onShowToast,
  onNavigateToShoppingList,
}: RecipeRecommendationViewProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(() => ediensStore.getRecipes());
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'quick' | 'highProtein'>('all');

  // 422 Missing Ingredients Modal State
  const [missingModalData, setMissingModalData] = useState<{
    recipeTitle: string;
    missingIngredients: InsufficientInventoryExtensions['missingIngredients'];
  } | null>(null);

  const loadRecipes = () => {
    setRecipes(ediensStore.getRecipes());
  };

  useEffect(() => {
    loadRecipes();
    const unsub = ediensStore.subscribe(() => {
      loadRecipes();
    });
    return unsub;
  }, []);

  const handleCook = (recipe: Recipe) => {
    const result = ediensStore.cookRecipe(recipe.id);

    if (result.success) {
      onShowToast(
        '1-Click Cook виконано!',
        `Страву «${recipe.title}» приготовано. Інгредієнти списано зі складу за FEFO, а КБЖВ (+${recipe.totalCalories} ккал, +${recipe.totalProtein}г білка) додано до щоденника.`,
        'success'
      );
    } else if (result.missingIngredients && result.missingIngredients.length > 0) {
      // 422 reaction modal
      setMissingModalData({
        recipeTitle: recipe.title,
        missingIngredients: result.missingIngredients,
      });
    }
  };

  const handleAddToShoppingList = (
    missing: InsufficientInventoryExtensions['missingIngredients']
  ) => {
    const itemsToAdd = missing.map((m) => ({
      productName: m.productName,
      quantity: Math.max(1, m.requiredQuantity - (m.availableQuantity || 0)),
      unit: m.unit,
    }));

    ediensStore.addMultipleShoppingItems(itemsToAdd);
    onShowToast(
      'Додано до списку покупок',
      `${itemsToAdd.length} інгредієнт(ів) успішно внесено до списку покупок домогосподарства.`,
      'success'
    );
  };

  const filteredRecipes = recipes.filter((r) => {
    if (filterMode === 'available') {
      return r.ingredients.every((ing) => ing.isAvailable);
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
          <RecipeCard key={recipe.id} recipe={recipe} onCook={handleCook} />
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
