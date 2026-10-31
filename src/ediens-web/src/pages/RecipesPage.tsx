import { RecipeRecommendationView } from '../features/recipes/RecipeRecommendationView';

export interface RecipesPageProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToShoppingList?: () => void;
}

export function RecipesPage({ onShowToast, onNavigateToShoppingList }: RecipesPageProps) {
  return (
    <RecipeRecommendationView
      onShowToast={onShowToast}
      onNavigateToShoppingList={onNavigateToShoppingList}
    />
  );
}
