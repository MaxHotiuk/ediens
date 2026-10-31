import { ShoppingListView } from '../features/shopping/ShoppingListView';

export interface ShoppingListPageProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function ShoppingListPage({ onShowToast }: ShoppingListPageProps) {
  return <ShoppingListView onShowToast={onShowToast} />;
}
