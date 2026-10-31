import { InventoryDashboard } from '../features/inventory/InventoryDashboard';

export interface InventoryPageProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function InventoryPage({ onShowToast }: InventoryPageProps) {
  return <InventoryDashboard onShowToast={onShowToast} />;
}
