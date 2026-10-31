import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { InsufficientInventoryExtensions } from '../../types/api';
import { ShoppingCart, AlertCircle, Plus } from 'lucide-react';

export interface MissingIngredientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeTitle?: string;
  missingIngredients: InsufficientInventoryExtensions['missingIngredients'];
  onAddToShoppingList: (items: InsufficientInventoryExtensions['missingIngredients']) => void;
  onNavigateToShoppingList?: () => void;
}

export function MissingIngredientsModal({
  isOpen,
  onClose,
  recipeTitle = 'Обраний рецепт',
  missingIngredients,
  onAddToShoppingList,
  onNavigateToShoppingList,
}: MissingIngredientsModalProps) {
  const handleAddAndClose = () => {
    onAddToShoppingList(missingIngredients);
    onClose();
  };

  const handleAddAndNavigate = () => {
    onAddToShoppingList(missingIngredients);
    onClose();
    onNavigateToShoppingList?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2 text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Недостатньо продуктів для 1-Click Cook (422)</span>
        </div>
      }
      description={
        <span>
          Для приготування страви <strong>«{recipeTitle}»</strong> у вашому холодильнику бракує необхідних інгредієнтів.
        </span>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрити
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleAddAndClose}
            >
              Додати до списку покупок
            </Button>

            <Button
              variant="default"
              size="sm"
              icon={<ShoppingCart className="h-4 w-4 text-zinc-950" />}
              onClick={handleAddAndNavigate}
            >
              Додати та перейти до списку
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Відсутні інгредієнти:
          </div>

          <div className="space-y-2">
            {missingIngredients.map((ing, idx) => {
              const shortage = Math.max(0, ing.requiredQuantity - (ing.availableQuantity || 0));
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-rose-900/40"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-zinc-100">{ing.productName}</div>
                    <div className="text-xs text-zinc-400 font-mono">
                      Потрібно: {ing.requiredQuantity} {ing.unit} • В наявності: {ing.availableQuantity || 0} {ing.unit}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded">
                      Бракує: {shortage} {ing.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-800/50 flex items-start gap-2.5 text-xs text-sky-200">
          <ShoppingCart className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <p>
            Натисніть кнопку нижче, щоб автоматично додати всі відсутні продукти з точними об&apos;ємами
            до <strong>Спільного списку покупок</strong> домогосподарства.
          </p>
        </div>
      </div>
    </Modal>
  );
}
