import { MacroTrackerView } from '../features/macros/MacroTrackerView';

export interface MacroTrackerPageProps {
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function MacroTrackerPage({ onShowToast }: MacroTrackerPageProps) {
  return <MacroTrackerView onShowToast={onShowToast} />;
}
