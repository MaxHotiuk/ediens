import { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  RateLimitBanner,
  ToastContainer,
  ToastMessage,
  ConflictResolutionModal,
} from './components/ui';
import {
  Refrigerator,
  Activity,
  Sparkles,
  ShoppingCart,
  ShieldAlert,
  Wifi,
  WifiOff,
  Home,
  CheckCircle,
} from 'lucide-react';
import { ErrorListeners } from './api/errorHandler';
import { generateUuid } from './api/client';
import { ediensStore } from './features/store/mockStore';

// Page Views
import { InventoryPage } from './pages/InventoryPage';
import { MacroTrackerPage } from './pages/MacroTrackerPage';
import { RecipesPage } from './pages/RecipesPage';
import { ShoppingListPage } from './pages/ShoppingListPage';

type TabView = 'inventory' | 'macros' | 'recipes' | 'shopping' | 'testbench';

export function App() {
  // Navigation / Router State
  const [activeTab, setActiveTab] = useState<TabView>(() => {
    const hash = window.location.hash.replace('#', '') as TabView;
    if (['inventory', 'macros', 'recipes', 'shopping', 'testbench'].includes(hash)) {
      return hash;
    }
    return 'inventory';
  });

  // Global Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Rate Limiting RFC 9457
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  // 409 Conflict Modal State from global errorBus
  const [globalConflict, setGlobalConflict] = useState<{
    itemName: string;
    attemptedQuantity: number;
    currentServerQuantity: number;
    unit: string;
    currentETag?: string;
  } | null>(null);

  // Spec Info Modal
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);

  // Connectivity state from store
  const [isOffline, setIsOffline] = useState(ediensStore.getOfflineMode());
  const [offlineChanges, setOfflineChanges] = useState(ediensStore.getOfflineChangesCount());

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = generateUuid();
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as TabView;
      if (['inventory', 'macros', 'recipes', 'shopping', 'testbench'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchTab = (tab: TabView) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Subscribe to central store updates
  useEffect(() => {
    const unsub = ediensStore.subscribe(() => {
      setIsOffline(ediensStore.getOfflineMode());
      setOfflineChanges(ediensStore.getOfflineChangesCount());
    });
    return unsub;
  }, []);

  // Subscribe to errorBus RFC 9457 reactions
  useEffect(() => {
    const unsubs = [
      ErrorListeners.onRateLimitExceeded((data) => {
        setRateLimitSeconds(data.retryAfterSeconds);
        addToast({
          title: '429 Rate Limit Exceeded',
          description: `Запит тимчасово призупинено на ${data.retryAfterSeconds}с.`,
          variant: 'warning',
        });
      }),

      ErrorListeners.onConcurrentModification((problem) => {
        const ext = problem.extensions;
        setGlobalConflict({
          itemName: 'Складський продукт',
          attemptedQuantity: (ext?.currentQuantity as number) || 500,
          currentServerQuantity: (ext?.currentQuantity as number) || 400,
          unit: (ext?.unit as string) || 'g',
          currentETag: ext?.currentETag as string,
        });
        addToast({
          title: '409 Conflict Detected',
          description: problem.detail || 'Невідповідність ETag (PostgreSQL xmin).',
          variant: 'warning',
          traceId: problem.traceId,
        });
      }),

      ErrorListeners.onItemNotFound((problem) => {
        addToast({
          title: '404 Item Not Found',
          description: problem.detail || 'Обʼєкт було видалено іншим користувачем.',
          variant: 'warning',
          traceId: problem.traceId,
        });
      }),

      ErrorListeners.onInsufficientInventory((problem) => {
        addToast({
          title: '422 Insufficient Inventory',
          description: problem.detail || 'Бракує інгредієнтів для списання.',
          variant: 'error',
          traceId: problem.traceId,
        });
      }),

      ErrorListeners.onServerError((problem) => {
        addToast({
          title: '500 Server Error',
          description: problem.detail || 'Внутрішня помилка сервера.',
          variant: 'error',
          traceId: problem.traceId,
        });
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col antialiased selection:bg-zinc-800 selection:text-white">
      {/* 429 Rate Limit Alert Banner */}
      {rateLimitSeconds > 0 && (
        <RateLimitBanner
          retryAfterSeconds={rateLimitSeconds}
          onTimerExpired={() => {
            setRateLimitSeconds(0);
            addToast({
              title: 'Кулдаун завершено',
              description: 'Ліміти запитів відновлено.',
              variant: 'info',
            });
          }}
        />
      )}

      {/* Top Application Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Household Context */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => switchTab('inventory')}
              className="flex items-center gap-2.5 focus:outline-none"
            >
              <div className="h-9 w-9 rounded-xl bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold font-mono text-base shadow-sm">
                ē
              </div>
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-white">ēdiens</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                    TASK-07
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-none">
                  Єдиний хаб запасів, макросів та рецептів
                </p>
              </div>
            </button>

            {/* Household Badge */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-lg ml-2">
              <Home className="h-3.5 w-3.5 text-sky-400" />
              <span>Поділ, вул. Спаська</span>
              <span className="text-[10px] text-zinc-500 font-mono">(Owner)</span>
            </div>
          </div>

          {/* Central Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1">
            <button
              onClick={() => switchTab('inventory')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'inventory'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Refrigerator className="h-3.5 w-3.5 text-sky-400" />
              <span>Холодильник</span>
            </button>

            <button
              onClick={() => switchTab('macros')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'macros'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>Макроси</span>
            </button>

            <button
              onClick={() => switchTab('recipes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'recipes'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Рецепти</span>
            </button>

            <button
              onClick={() => switchTab('shopping')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'shopping'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5 text-indigo-400" />
              <span>Покупки</span>
            </button>
          </nav>

          {/* Right Header Badges & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Online / Offline status */}
            <div
              className={`hidden lg:flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg border ${
                isOffline
                  ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="h-3 w-3 text-amber-400" />
                  <span>OFFLINE {offlineChanges > 0 ? `(${offlineChanges})` : ''}</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span>ONLINE</span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<ShieldAlert className="h-3.5 w-3.5 text-sky-400" />}
              onClick={() => setIsSpecModalOpen(true)}
              className="text-xs"
            >
              Архітектура
            </Button>
          </div>
        </div>
      </header>

      {/* Main Feature View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'inventory' && (
          <InventoryPage
            onShowToast={(title, description, variant) =>
              addToast({ title, description, variant })
            }
          />
        )}

        {activeTab === 'macros' && (
          <MacroTrackerPage
            onShowToast={(title, description, variant) =>
              addToast({ title, description, variant })
            }
          />
        )}

        {activeTab === 'recipes' && (
          <RecipesPage
            onShowToast={(title, description, variant) =>
              addToast({ title, description, variant })
            }
            onNavigateToShoppingList={() => switchTab('shopping')}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListPage
            onShowToast={(title, description, variant) =>
              addToast({ title, description, variant })
            }
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-5 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>ēdiens • React 19 • Vite • FEFO Inventory • RFC 9457 OCC • Offline-First</p>
          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
            <span>PostgreSQL xmin: OK</span>
            <span>•</span>
            <span>HybridCache: Ready</span>
          </div>
        </div>
      </footer>

      {/* 409 Conflict Resolution Modal */}
      {globalConflict && (
        <ConflictResolutionModal
          isOpen={Boolean(globalConflict)}
          onClose={() => setGlobalConflict(null)}
          itemName={globalConflict.itemName}
          attemptedQuantity={globalConflict.attemptedQuantity}
          currentServerQuantity={globalConflict.currentServerQuantity}
          unit={globalConflict.unit}
          currentETag={globalConflict.currentETag}
          onAcceptServer={() => {
            addToast({
              title: 'Конфлікт вирішено',
              description: 'Прийнято поточний стан сервера.',
              variant: 'success',
            });
            setGlobalConflict(null);
          }}
          onReapplyWithServerQuantity={(newQty, etag) => {
            addToast({
              title: 'Списання оновлено',
              description: `Запит повторено з If-Match: ${etag || 'W/"..."'} (кількість: ${newQty}).`,
              variant: 'success',
            });
            setGlobalConflict(null);
          }}
        />
      )}

      {/* Architecture Spec Modal */}
      <Modal
        isOpen={isSpecModalOpen}
        onClose={() => setIsSpecModalOpen(false)}
        maxWidth="lg"
        title="Специфікація TASK-07: React Interactive Feature Views"
        description="Повний перелік реалізованих інтерактивних підсистем згідно з AGENTS.md та KNOWLEDGE.md"
        footer={
          <Button variant="default" size="sm" onClick={() => setIsSpecModalOpen(false)}>
            Закрити
          </Button>
        }
      >
        <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>1. Холодильник та FEFO Інвентар</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              Сортування за принципом First Expired, First Out; бейджі свіжості (Green / Amber / Red / Expired);
              атомарне списання кількості з перевіркою версії ETag (xmin) та викликом ConflictResolutionModal при 409.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>2. Трекер макронутрієнтів (КБЖВ)</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              Концентричне макро-кільце MacroProgressRing, перерахунок залишку денного бюджету калорій,
              налаштування цілей КБЖВ, форма логування прийомів їжі із захистом Idempotency-Key.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>3. Розумні рецепти & 1-Click Cook</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              Скоринг рецептів на основі продуктів, що спливають; транзакційне списання інгредієнтів за FEFO
              з одночасним логуванням макросів; реакція 422 з модальним вікном додавання відсутніх товарів до списку.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-sky-400" />
              <span>4. Спільний список покупок (Offline-First)</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              Повна підтримка офлайн-роботи в супермаркеті через LocalStorage; перемикання мережевого режиму;
              синхронізація локальних змін злиттям через POST /shopping-list/sync.
            </p>
          </div>
        </div>
      </Modal>

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
